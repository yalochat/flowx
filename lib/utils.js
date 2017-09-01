'use strict'

const _ = require('lodash')

const prepareModel = (model) => {
  const updatedModel = _.cloneDeep(model)
  const ttl = updatedModel.ttl | 0
  const states = updatedModel.states.map((state) => {
    if (state.globalTransitions) {
      const defaultTransition = _.remove(state.transitions, transition => transition.when === '*')
      const transitions = _.concat(state.transitions, updatedModel.globalTransitions, defaultTransition)
      return _.merge(state, { transitions })
    }
    return state
  })
  return _.merge(updatedModel, { states, ttl })
}

module.exports = {
  prepareModel
}
