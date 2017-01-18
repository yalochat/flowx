'use strict'
const Promise = require('bluebird')
const EventEmitter = require('events');

let externals = {}

class flowEmitter extends EventEmitter { }

const INITIAL_STATE = 0


externals.Instance = (function () {

  function Instance(model) {
    /*this.flow = flow
    this.id = id*/
    console.log(JSON.stringify(model))
    this.model = model
    this.actualState = this.model.states[INITIAL_STATE]
    this.middlewares = []
  }

  Instance.prototype.searchNextState = function (stateName) {
    return new Promise((resolve, reject) => {
      this.model.states.forEach((v) => {
        if (v.name === stateName) {
          return resolve(v)
        }
      })
    })
  }

  Instance.prototype.validateTransition = function (transitionName) {
    return new Promise((resolve, reject) => {
      if (this.actualState.transitions) {
        this.actualState.transitions.forEach((v) => {
          if (v.name === transitionName) {
            return resolve(v)
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
      if (data.action) {
        this.validateTransition(data.action).then((transition) => {
          this.searchNextState(transition.to).then((v) => {
            if (transition.use) {
              this.middlewares[transition.use](this.actualState, (data) => {
                this.actualState = v
                return resolve(this.actualState)
              })
            } else {
              this.actualState = v
              if (this.actualState.onEnter) {
                if (this.actualState.onEnter.emit) {
                  this.internalEmitter.emit(this.actualState.onEnter.emit, this.actualState.onEnter.data)
                }
              }
              return resolve(this.actualState)
            }
          })
        }).catch((err) => {
          return resolve({ template: err })
        })
      } else {
        return resolve(this.actualState)
      }
    })
  }

  Instance.prototype.register = function (name, fn) {
    this.middlewares[name] = fn
  }

  return Instance
})()


externals.Flow = (function () {

  function Flow(name, model) {
    this.name = name
    this.model = model
    this.instances = []
    this.internalEmitter = new flowEmitter();
  }

  Flow.prototype.newInstance = function (id) {
    this.instances[id] = new externals.Instance(this.model)
    return this.instances[id]
  }

  Flow.prototype.addInstance = function (instance) {
    this.instance[instance.id] = instance
    return this.instances[instance.id]
  }

  Flow.prototype.getInstance = function (id) {
    return this.instances[id]
  }

  Flow.prototype.on = function (eventName, eventFunction) {
    this.internalEmitter.on(eventName, eventFunction)
  }

  return Flow

})()

module.exports = externals