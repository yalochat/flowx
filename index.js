'use strict'
const _ = require('lodash')
const Promise = require('bluebird')
const EventEmitter = require('events')
const Matchers = require('./lib/matchers')
const Utils = require('./lib/utils')
const Catbox = require('catbox')
const CatboxRethinkdb = require('catbox-rethinkdb')

const r = require('rethinkdbdash')({
  host: process.env.RETHINKDB_HOST || 'rethinkdb',
  db: process.env.RETHINKDB_DB || 'flowxdb',
});

let externals = {}

const INITIAL_STATE = 0

const tableName = process.env.RETHINKDB_FLOWXTABLE || 'flowxtable'

const catboxOptions = {
  host: process.env.RETHINKDB_HOST || 'rethinkdb',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'flowxdb',
  table: tableName
}

const client = new Catbox.Client(CatboxRethinkdb, catboxOptions)

module.exports.new = () => {
  return new Promise((resolve, reject) => {
    client.start((err) => {
      if (err) {
        reject(err)
      }

      externals.Instance = (function () {

        function Instance(id, middlewares, initState) {
          this.id = id
          this.currentState = initState
          this.middlewares = []
          this.middlewares = middlewares
        }

        return Instance
      })()

      externals.Flow = (function () {

        function Flow(name, model) {
          this.name = name
          this.instances = []
          this.middlewares = []
          this.internalEmitter = {}

          //Load globalTransitions and sort all transitions
          this.model = Utils.prepareModel(model)
        }

        Flow.prototype.newInstance = function (id) {
          return new Promise((resolve, reject) => {
            const newState = _.cloneDeep(this.model.states[INITIAL_STATE])
            const newInstance = new externals.Instance(id, this.middlewares, newState)
            console.log('Creating new instance ' + JSON.stringify(newInstance))
            client.set(id, newInstance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(newInstance)
            })
          })
        }

        Flow.prototype.addInstance = function (instance) {
          return new Promise((resolve, reject) => {
            client.set(instance.id, instance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(instance)
            })
          })
        }

        Flow.prototype.getInstance = function (id) {
          return new Promise((resolve, reject) => {
            client.get(id, (err, cached) => {
              if (err || !cached) {
                this.newInstance(id).then((newInstance) => {
                  resolve(newInstance)
                }).catch((err) => {
                  reject(err)
                })
              } else {
                console.log(`Instance found: ${JSON.stringify(cached.item)}`)
                resolve(cached.item)
              }
            })
          })
        }

        Flow.prototype.searchNextState = function (stateName, global) {
          return new Promise((resolve, reject) => {
            for (var i = 0; i < this.model.states.length; i++) {
              if (this.model.states[i].name === stateName && (global === false || this.model.states[i].global)) {
                const newState = _.cloneDeep(this.model.states[i])
                return resolve(newState)
              }
            }
            return reject(new Error(`State: ${stateName} => not found!`))
          })
        }

        Flow.prototype.validateTransition = function (instance, transitionName) {
          return new Promise((resolve, reject) => {
            if (instance.currentState.transitions) {
              for (var i = 0; i < instance.currentState.transitions.length; i++) {
                if (
                    Matchers.matchRule(instance.currentState.transitions[i].when, transitionName) ||
                    Matchers.matchRegExp(instance.currentState.transitions[i].when, transitionName) ||
                    Matchers.matchAll(instance.currentState.transitions[i].when)
                ) {
                  return resolve(instance.currentState.transitions[i])
                }
              }
              console.log(`Transition not found, searching for global state: ${transitionName}`)
              return resolve(transitionName)
            } else {
              console.log(`Transitions not found, searching for global state: ${transitionName}`)
              return resolve(transitionName)
            }
          })
        }

        Flow.prototype.getState = function (instance, data) {
          return new Promise((resolve, reject) => {
            if (data && data.action) {
              this.validateTransition(instance, data.action).then((transition) => {
                this.searchNextState(transition.to || transition, transition.to === undefined).then((nextState) => {
                  if (transition.use) {
                    instance.middlewares[transition.use](instance.currentState, (data) => {
                      instance.currentState = nextState

                      client.set(instance.id, instance, this.model.ttl, (err) => {
                        if (err) {
                          reject(err)
                        }
                        if (instance.currentState.onEnter) {
                          if (instance.currentState.onEnter.emit) {
                            this.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
                          }
                        }
                        resolve(instance.currentState)
                      })
                    })
                  } else {
                    instance.currentState = nextState
                    client.set(instance.id, instance, this.model.ttl, (err) => {
                      console.log(`New state: ${JSON.stringify(instance)}`)
                      if (err) {
                        reject(err)
                      }
                      if (instance.currentState.onEnter) {
                        if (instance.currentState.onEnter.emit) {
                          this.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
                        }
                      }
                      resolve(instance.currentState)
                    })

                  }
                }).catch((err) => {
                  this.goToDefault(instance).then((state) => {
                    return resolve(state)
                  })
                })
              }).catch((err) => {
                this.goToDefault(instance).then((state) => {
                  return resolve(state)
                })
              })
            } else {
              return resolve(instance.currentState)
            }
          })
        }

        Flow.prototype.goToDefault = function (instance) {
          return new Promise((resolve, reject) => {
            this.searchNextState('default', false).then((nextState) => {
              instance.currentState = nextState
              client.set(instance.id, instance, this.model.ttl, (err) => {
                if (err) {
                  reject(err)
                }
                if (instance.currentState.onEnter) {
                  if (instance.currentState.onEnter.emit) {
                    this.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
                  }
                }
                resolve(instance.currentState)
              })
            }).catch((err) => {
              return resolve({ template: err })
            })
          })
        }

        Flow.prototype.saveInstance = function (instance) {
          return new Promise((resolve, reject) => {
            client.set(instance.id, instance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(instance)
            })
          })
        }

        Flow.prototype.on = function (eventName, eventFunction) {
          this.internalEmitter.on(eventName, eventFunction)
        }

        Flow.prototype.register = function (name, fn) {
          this.middlewares[name] = fn
        }

        Flow.prototype.getInstancesBySegment = function (segment) {
          return new Promise((resolve, reject) => {
            r.table(tableName).filter({
              value: {
                id: {
                  segment: segment
                }
              }
            }).run().then(instances => {
              return resolve(instances)
            }).catch(error => {
              return reject(error)
            })
          })
        }

        Flow.prototype.findInstances = function (filter) {
          return new Promise((resolve, reject) => {
            r.table(tableName).filter(filter).run().then(instances => {
              return resolve(instances)
            }).catch(error => {
              return reject(error)
            })
          })
        }

        return Flow

      })()

      resolve(externals)

    })
  })
}