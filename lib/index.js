const _ = require('lodash')
const Catbox = require('catbox')
const CatboxRethinkdb = require('catbox-rethinkdb')
const Promise = require('bluebird')
const rethinkdbdash = require('rethinkdbdash')

const Matchers = require('./matchers')
const Utils = require('./utils')

const r = rethinkdbdash({
  host: process.env.RETHINKDB_HOST || 'localhost',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'flowxdb'
})

const INITIAL_STATE = 0
const TRANSITION_TYPE_WATCHDOG = 'watchdog'
const tableName = process.env.RETHINKDB_FLOWXTABLE || 'flowxtable'
const catboxOptions = {
  host: process.env.RETHINKDB_HOST || 'localhost',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'flowxdb',
  table: tableName
}

const client = Promise.promisifyAll(new Catbox.Client(CatboxRethinkdb, catboxOptions))

class Instance {
  constructor (id, middlewares, initState) {
    this.id = id
    this.currentState = initState
    this.middlewares = middlewares
  }
}

class Flow {
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
      const newInstance = new Instance(id, this.middlewares, newState)
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
          this.newInstance(id).  then((newInstance) => {
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
        return (
          state.id === stateName || state.id === parseInt(stateName, 10) || state.name === stateName) &&
          (global === false || state.global !== undefined)
      })
      console.log('searchNextState: %j', { stateName, global })
      console.log('searchNextState::newState: %j', newState)
      return newState ? resolve(_.cloneDeep(newState)) : reject(new Error(`State: ${stateName} => not found!`))
    })
  }

  validateTransition (instance, action) {
    return new Promise((resolve, reject) => {
      if (instance.currentState.transitions) {
        return Promise.reduce(instance.currentState.transitions, (result, transition) => {
          console.log("Check last result: %j", { result, transition })
          if(result.match) {
            return result
          }

          return Matchers
            .match(transition, action, { cache: result.cache, domain: this.name })
            .then(match => {
              if(match.match) {
                return match
              } 

              return {
                action: match.action,
                rule: match.rule,
                match: false,
                cache: match.cache,
              }
            })
        }, {
          action,
          rule: action,
          match: false,
          cache: {},
        })
        .then((rule_match) => {
          console.log('Transition found: %j', rule_match)
          const rule = rule_match.match ? rule_match.rule : (rule_match.action.value || rule_match.action)
          return resolve(rule)
        })
        .catch((error) => {
          console.error('Error matching transition', error)
          return resolve(action)
        })
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
        this.validateTransition(updatedInstance, data.action)
          .then((transition) => {
            console.log("Validate last transition: %j", transition)
            return this.searchNextState(transition.to || transition, transition.to === undefined)
              .then((nextState) => {
                console.log('nextState: %j', nextState)
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
                      return resolve({state: updatedInstance.currentState, transition})
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
                    return resolve({state: updatedInstance.currentState, transition})
                  })
                }
              }).catch((e) => {
                console.error('Error searching for next state', e)
                return this.goToDefault(updatedInstance).then((state) => {
                  return resolve({state, transition})
                }).catch((err) => {
                  return reject(err)
                })
              })
          }).catch((e) => {
            console.error('Error searching for next state', e)
            return this.goToDefault(updatedInstance).then((state) => {
              return resolve({state, transition: {}})
            }).catch((err) => {
              return reject(err)
            })
          })
      } else {
        return resolve({state: updatedInstance.currentState, transition: {}})
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

module.exports.new = () => client.startAsync()
  .then(() => {
    return { Instance, Flow }
  })

