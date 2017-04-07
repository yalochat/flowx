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
          this.actualState = initState
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

        Flow.prototype.searchNextState = function (stateName) {
          return new Promise((resolve, reject) => {
            this.model.states.forEach((state) => {
              if (state.name === stateName) {
                return resolve(state)
              }
            })
            return reject(new Error('No default state found'))
          })
        }

        Flow.prototype.validateTransition = function (instance, transitionName) {
          return new Promise((resolve, reject) => {
            if (instance.actualState.transitions) {
              instance.actualState.transitions.forEach((transition) => {
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

        Flow.prototype.getState = function (instance, data) {
          return new Promise((resolve, reject) => {
            if (data && data.action) {
              this.validateTransition(instance, data.action).then((transition) => {
                this.searchNextState(transition.to).then((nextState) => {
                  if (transition.use) {
                    instance.middlewares[transition.use](instance.actualState, (data) => {
                      instance.actualState = nextState

                      client.set(instance.id, instance, this.model.ttl, (err) => {
                        if (err) {
                          reject(err)
                        }
                        if (instance.actualState.onEnter) {
                          if (instance.actualState.onEnter.emit) {
                            instance.internalEmitter.emit(instance.actualState.onEnter.emit, instance.actualState.onEnter.data)
                          }
                        }
                        resolve(instance.actualState)
                      })
                    })
                  } else {
                    instance.actualState = nextState
                    client.set(instance.id, instance, this.model.ttl, (err) => {
                      console.log('EL NUEVO ESTADO ' + JSON.stringify(instance))
                      if (err) {
                        reject(err)
                      }
                      if (instance.actualState.onEnter) {
                        if (instance.actualState.onEnter.emit) {
                          instance.internalEmitter.emit(instance.actualState.onEnter.emit, instance.actualState.onEnter.data)
                        }
                      }
                      resolve(instance.actualState)
                    })

                  }
                })
              }).catch((err) => {
                this.searchNextState('default').then((nextState) => {
                  instance.actualState = nextState
                  client.set(instance.id, instance, this.model.ttl, (err) => {
                    if (err) {
                      reject(err)
                    }
                    if (instance.actualState.onEnter) {
                      if (instance.actualState.onEnter.emit) {
                        instance.internalEmitter.emit(instance.actualState.onEnter.emit, instance.actualState.onEnter.data)
                      }
                    }
                    resolve(instance.actualState)
                  })
                }).catch((err) => {
                  return resolve({ template: err })
                })
              })
            } else {
              return resolve(instance.actualState)
            }
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