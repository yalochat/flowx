'use strict'

const _ = require('lodash')

const prepareModel = (model) => {
  const states = model.states.map((state) => {
    if(state.globalTransitions){
      const defaultTransition = _.remove(state.transitions, (transition) => transition.when === '*')
      const transition = _.concat(state.transitions, model.globalTransitions, defaultTransition)
      return _.merge(state, {transitions})
    }
    return state
  })
  return _.merge(model, {states})
}

module.exports = {
  prepareModel
}