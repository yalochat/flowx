const Promise = require('bluebird')
const watchdogSdk = require('@engyalo/watchdog-sdk')

const TRANSITION_TYPE_WATCHDOG = 'watchdog'

const matchRule = (rule, action, _separator) => {
  return rule === action
}

const matchRegExp = (rule, action) => {
  const ruleArray = rule.split('/')
  let exp = {}

  if (ruleArray.length > 1) {
    exp = new RegExp(ruleArray[1], ruleArray[2])
    return exp.test(action)
  }
  return false
}

const matchAll = (rule) => {
  return rule === '*'
}

const matchWatchdogActions = (rule, wdActions, cache) => {
  const { when, confidence } = rule
  return wdActions.reduce((result, action) => {
    if(result.match) {
      return result
    }

    return {
      action,
      rule,
      cache,
      match: (matchRule(when, action.value) ||
        matchRegExp(when, action.value) ||
        matchAll(when)) && action.confidence >= confidence,
    }
  }, {
    action: wdActions,
    rule,
    cache,
    match: false
  })
  
}

const matchWatchdog = (domain, rule, action, cache) => {
  if(cache.wdCalled) {
    return matchWatchdogActions(rule, cache.wdActions, cache)
  }

  return watchdogSdk.getIntent(domain, action.value)
    .then((wdResponse) => {
      const wdClassification = wdResponse.results[0]
      const intents = wdClassification.intents.filter(w => w.category !== 'UKN')
      const wdActions = intents.map(intent => ({
        value: intent.category,
        confidence: intent.confidence,
      }))

      return matchWatchdogActions(rule, wdActions, {
        wdCalled: true,
        wdClassification,
        wdActions,
      })
    }).catch((e) => {
      console.error('Error while getting intent from watchdog', e)
      return {
        action,
        match: false, // check
        cache: {
          wdCalled: true,
          wdClassification: null,
          wdActions: [],
        },
      }
    })
}

const matchOne = Promise.method((rule, action, { cache={}, domain='' }={}) => {
  const { type, when } = rule
  const value = action.value || action

  if(type === TRANSITION_TYPE_WATCHDOG) {
    return matchWatchdog(domain, rule, action, cache)
  }

  // console.log("when: %j", when)
  // console.log("action: %j", action)
  // console.log("(matchRule(when, action) || matchRegExp(when, action) || matchAll(when)): %j", (matchRule(when, action) || matchRegExp(when, action) || matchAll(when)))
  // console.log(" ((rule.confidence === undefined && action.confidence === undefined) || action.confidence >= rule.confidence): %j",  ((rule.confidence === undefined && action.confidence === undefined) || action.confidence >= rule.confidence))
  return {
    action,
    rule,
    cache,
    match: (action.type === rule.type) &&
      (matchRule(when, value) ||
        matchRegExp(when, value) ||
        matchAll(when)) &&
      ((rule.confidence === undefined && action.confidence === undefined) ||
        action.confidence >= rule.confidence),
  }
})

const matchList = (rule, actionsList, { cache={}, domain='' }={}) => {
  return Promise
    .reduce(actionsList, (result, action) => {
      if(result.match) {
        return result
      }
      
      return matchOne(rule, action, { domain, cache: result.cache })
    }, {
      action: { value: '' },
      match: false,
      rule: null,
      cache: cache,
    })
    .then((transition_info) => {
      // if(!transition_info.match && transition_info.cache.watchdog && transition_info.transition.type !== TRANSITION_TYPE_WATCHDOG) {
        // TODO Mark classification as not used
      // }

      console.log('transition_info: %j', transition_info)

      return transition_info
    })
}

const match = (rule, action, options={}) => {
  if (Array.isArray(action)) {
    return matchList(rule, action, options)
  }

  return matchOne(rule, action, options)
}

module.exports = {
  match,
  matchRule,
  matchRegExp,
  matchAll,
  matchOne,
  matchList
}
