'use strict'
const Promise = require('bluebird')
const EventEmitter = require('events');
const Utils = require('./utils')
const Catbox = require('catbox')
const CatboxMemory = require('catbox-memory')

let externals = {}

class flowEmitter extends EventEmitter { }

const INITIAL_STATE = 0

const client = new Catbox.Client(CatboxMemory)

module.exports.new = () => {
  return new Promise((resolve, reject) => {
    client.start((err) => {
      if (err) {
        reject(err)
      }

      externals.Instance = (function () {

        function Instance(model, emitter, middlewares) {
          /*this.flow = flow
          this.id = id*/
          this.model = model
          this.actualState = this.model.states[INITIAL_STATE]
          this.middlewares = []
          this.internalEmitter = emitter
          this.middlewares = middlewares
        }

        Instance.prototype.searchNextState = function (stateName) {
          return new Promise((resolve, reject) => {
            this.model.states.forEach((state) => {
              if (state.name === stateName) {
                return resolve(state)
              }
            })
            return reject(new Error('No default state found'))
          })
        }

        Instance.prototype.validateTransition = function (transitionName) {
          return new Promise((resolve, reject) => {
            if (this.actualState.transitions) {
              this.actualState.transitions.forEach((transition) => {
                if (Utils.matchRule(transition.name, transitionName) || Utils.matchRegExp(transition.name, transitionName)) {
                  return resolve(transition)
                }
              })
              return reject(new Error('No se pudo encontrar el estado en las transiciones'))
            } else {
              return reject(new Error('No se pudo encontrar el estado en las transiciones'))
            }
          })
        }

        Instance.prototype.getState = function (data) {
          return new Promise((resolve, reject) => {
            if (data && data.action) {
              this.validateTransition(data.action).then((transition) => {
                this.searchNextState(transition.to).then((nextState) => {
                  if (transition.use) {
                    this.middlewares[transition.use](this.actualState, (data) => {
                      this.actualState = nextState
                      return resolve(this.actualState)
                    })
                  } else {
                    this.actualState = nextState
                    if (this.actualState.onEnter) {
                      if (this.actualState.onEnter.emit) {
                        this.internalEmitter.emit(this.actualState.onEnter.emit, this.actualState.onEnter.data)
                      }
                    }
                    return resolve(this.actualState)
                  }
                })
              }).catch((err) => {
                this.searchNextState('default').then((nextState) => {
                  this.actualState = nextState
                  if (this.actualState.onEnter) {
                    if (this.actualState.onEnter.emit) {
                      this.internalEmitter.emit(this.actualState.onEnter.emit, this.actualState.onEnter.data)
                    }
                  }
                  return resolve(this.actualState)
                }).catch((err) => {
                  return resolve({ template: err })
                })
              })
            } else {
              return resolve(this.actualState)
            }
          })
        }

        return Instance
      })()

      externals.Flow = (function () {

        function Flow(name, model) {
          this.name = name
          this.model = model
          this.instances = []
          this.middlewares = []
          this.internalEmitter = new flowEmitter();
        }

        Flow.prototype.newInstance = function (id) {
          //this.instances[id] = new externals.Instance(this.model, this.internalEmitter, this.middlewares)
          //return this.instances[id]
          return new Promise((resolve, reject) => {
            var newInstance = new externals.Instance(this.model, this.internalEmitter, this.middlewares)
            client.set(id, newInstance, this.model.ttl, (err) => {
              if (err) {
                reject(err)
              }
              resolve(newInstance)
            })
          })
        }

        Flow.prototype.addInstance = function (instance) {
          //this.instance[instance.id] = instance
          //return this.instances[instance.id]
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
          //return this.instances[id]
          return new Promise((resolve, reject) => {
            client.get(id, (err, cached) => {
              if (err) {
                this.newInstance(id).then((newInstance) => {
                  resolve(newInstance)
                }).catch((err) => {
                  reject(err)
                })
              } else {
                resolve(cached.item)
              }
            })
          })
        }

        Flow.prototype.on = function (eventName, eventFunction) {
          this.internalEmitter.on(eventName, eventFunction)
        }

        Flow.prototype.register = function (name, fn) {
          this.middlewares[name] = fn
        }

        return Flow

      })()

      resolve(externals)

    })
  })
}