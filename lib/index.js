'use strict'

const _ = require('lodash')
const Catbox = require('catbox')
const CatboxRethinkdb = require('catbox-rethinkdb')
const Promise = require('bluebird')

const Matchers = require('./matchers')
const Utils = require('./utils')

const r = require('rethinkdbdash')({
  host: process.env.RETHINKDB_HOST || 'localhost',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'flowxdb'
})

const tableName = process.env.RETHINKDB_FLOWXTABLE || 'flowxtable'

const catboxOptions = {
  host: process.env.RETHINKDB_HOST || 'localhost',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'flowxdb',
  table: tableName
}

const client = new Catbox.Client(CatboxRethinkdb, catboxOptions)

const externals = {}
const INITIAL_STATE = 0

module.exports.new = () => {
  return new Promise((resolve, reject) => {
    client.start((catboxError) => {
      if (catboxError) {
        reject(catboxError)
      }

      externals.Instance = class Instance {
        constructor (id, middlewares, initState) {
          this.id = id
          this.currentState = initState
          this.middlewares = []
          this.middlewares = middlewares
        }
      }

      externals.Flow = class Flow {
        constructor (name, model) {
          this.name = name
          this.instances = []
          this.middlewares = []
          this.internalEmitter = {}
          this.globalTransitions = model.globalTransitions || []

          // Load globalTransitions and sort all transitions
          this.model = Utils.prepareModel(model)
        }

        newInstance (id) {
          return new Promise((resolve, reject) => {
            const newState = _.cloneDeep(this.model.states.get(INITIAL_STATE))
            const newInstance = new externals.Instance(id, this.middlewares, newState)
            console.log(`Creating new instance %j`, newInstance)
            client.set(id, newInstance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(newInstance)
            })
          })
        }

        addInstance (instance) {
          return new Promise((resolve, reject) => {
            client.set(instance.id, instance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(instance)
            })
          })
        }

        getInstance (id) {
          return new Promise((resolve, reject) => {
            client.get(id, (err, cached) => {
              if (err || !cached) {
                this.newInstance(id).then((newInstance) => {
                  resolve(newInstance)
                }).catch((newInstanceError) => {
                  reject(newInstanceError)
                })
              } else {
                console.log(`Instance found: %j`, cached.item)
                resolve(cached.item)
              }
            })
          })
        }

        searchNextState (stateName, global) {
          return new Promise((resolve, reject) => {
            const newState = this.model.states.find((state, key) => {
              return (state.id === stateName || state.name === stateName) && (global === false || state.global !== undefined)
            })
            return newState ? resolve(_.cloneDeep(newState)) : reject(new Error(`State: ${stateName} => not found!`))
          })
        }

        validateTransition (instance, action) {
          return new Promise((resolve, reject) => {
            if (instance.currentState.transitions) {
              for (var i = 0; i < instance.currentState.transitions.length; i++) {
                if (Array.isArray(action) && Matchers.matchList(instance.currentState.transitions[i], action)) {
                  return resolve(instance.currentState.transitions[i])
                } else if (Matchers.matchOne(instance.currentState.transitions[i].when, action)) {
                  return resolve(instance.currentState.transitions[i])
                }
              }
              console.log(`Transition not found, searching for global state: ${action}`)
              return resolve(action)
            } else {
              console.log(`Transitions not found, searching for global state: ${action}`)
              return resolve(action)
            }
          })
        }

        getState (instance, data) {
          const updatedInstance = _.cloneDeep(instance)
          return new Promise((resolve, reject) => {
            if (data && data.action) {
              this.validateTransition(updatedInstance, data.action).then((transition) => {
                this.searchNextState(transition.to || transition, transition.to === undefined).then((nextState) => {
                  if (transition.use) {
                    updatedInstance.middlewares[transition.use](updatedInstance.currentState, (data) => {
                      updatedInstance.currentState = nextState

                      client.set(updatedInstance.id, updatedInstance, this.model.ttl, (err) => {
                        if (err) {
                          return reject(err)
                        }
                        if (updatedInstance.currentState.onEnter) {
                          if (updatedInstance.currentState.onEnter.emit) {
                            this.internalEmitter.emit(updatedInstance.currentState.onEnter.emit, updatedInstance.currentState.onEnter.data)
                          }
                        }
                        return resolve(updatedInstance.currentState)
                      })
                    })
                  } else {
                    updatedInstance.currentState = nextState
                    client.set(updatedInstance.id, updatedInstance, this.model.ttl, (err) => {
                      console.log(`New state: %j`, updatedInstance)
                      if (err) {
                        return reject(err)
                      }
                      if (updatedInstance.currentState.onEnter) {
                        if (updatedInstance.currentState.onEnter.emit) {
                          this.internalEmitter.emit(updatedInstance.currentState.onEnter.emit, updatedInstance.currentState.onEnter.data)
                        }
                      }
                      return resolve(updatedInstance.currentState)
                    })
                  }
                }).catch((err) => {
                  this.goToDefault(updatedInstance).then((state) => {
                    return resolve(state)
                  }).catch((err) => {
                    return reject(err)
                  })
                })
              }).catch((err) => {
                this.goToDefault(updatedInstance).then((state) => {
                  return resolve(state)
                }).catch((err) => {
                  return reject(err)
                })
              })
            } else {
              return resolve(updatedInstance.currentState)
            }
          })
        }

        goToDefault (instance) {
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

        saveInstance (instance) {
          return new Promise((resolve, reject) => {
            client.set(instance.id, instance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(instance)
            })
          })
        }

        on (eventName, eventFunction) {
          this.internalEmitter.on(eventName, eventFunction)
        }

        register (name, fn) {
          this.middlewares[name] = fn
        }

        getInstancesBySegment (segment) {
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

        findInstances (filter) {
          return new Promise((resolve, reject) => {
            r.table(tableName).filter(filter).run().then(instances => {
              return resolve(instances)
            }).catch(error => {
              return reject(error)
            })
          })
        }

        getGlobalTransitions () {
          return _.cloneDeep(this.globalTransitions)
        }
      }
      resolve(externals)
    })
  })
}
