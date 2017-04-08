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

        function Instance(id, emitter, middlewares, initState) {
          this.id = id
          this.currentState = initState
          this.middlewares = []
          this.internalEmitter = emitter
          this.middlewares = middlewares
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
          return new Promise((resolve, reject) => {
            var newInstance = new externals.Instance(id, this.internalEmitter, this.middlewares, this.model.states[INITIAL_STATE])
            console.log('CREANDO NUEVA INSTANCIA ' + JSON.stringify(newInstance))
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
                console.log('INSTANCIA ENCONTRADA ' + JSON.stringify(cached.item))
                resolve(cached.item)
              }
            })
          })
        }

        Flow.prototype.searchNextState = function (stateName, global) {
          return new Promise((resolve, reject) => {
            for (var i = 0; i < this.model.states.length; i++) {
              if (this.model.states[i].name === stateName && (global === false || this.model.states[i].global)) {
                return resolve(this.model.states[i])
              }
            }
            return reject(new Error(`State ${stateName} not found!`))
          })
        }

        Flow.prototype.validateTransition = function (instance, transitionName) {
          return new Promise((resolve, reject) => {
            if (instance.currentState.transitions) {
              for (var i = 0; i < instance.currentState.transitions.length; i++) {
                if (Utils.matchRule(instance.currentState.transitions[i].when, transitionName) || Utils.matchRegExp(instance.currentState.transitions[i].when, transitionName)) {
                  return resolve(instance.currentState.transitions[i])
                }
              }
              console.log('No se pudo encontrar el estado en las transiciones')
              return resolve(transitionName)
            } else {
              console.log('No se pudo encontrar ninguna transición')
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
                            instance.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
                          }
                        }
                        resolve(instance.currentState)
                      })
                    })
                  } else {
                    instance.currentState = nextState
                    client.set(instance.id, instance, this.model.ttl, (err) => {
                      console.log('EL NUEVO ESTADO ' + JSON.stringify(instance))
                      if (err) {
                        reject(err)
                      }
                      if (instance.currentState.onEnter) {
                        if (instance.currentState.onEnter.emit) {
                          instance.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
                        }
                      }
                      resolve(instance.currentState)
                    })

                  }
                }).catch((err) => {
                  console.log(err)
                  this.goToDefault(instance).then((state) => {
                    return resolve(state)
                  })
                })
              }).catch((err) => {
                console.log(err)
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
            this.searchNextState('default').then((nextState) => {
              instance.currentState = nextState
              client.set(instance.id, instance, this.model.ttl, (err) => {
                if (err) {
                  reject(err)
                }
                if (instance.currentState.onEnter) {
                  if (instance.currentState.onEnter.emit) {
                    instance.internalEmitter.emit(instance.currentState.onEnter.emit, instance.currentState.onEnter.data)
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

        return Flow

      })()

      resolve(externals)

    })
  })
}