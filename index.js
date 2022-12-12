/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Bacon = require('baconjs')
const _ = require('lodash')

module.exports = function (app) {
  let plugin = {}
  let unsubscribes = []

  plugin.start = function (props) {
    plugin.properties = props

    plugin.properties.values.forEach(valueConfig => {

      let stream = app.streambundle.getSelfBus(valueConfig.inputPath)
      let cache = [];
      unsubscribes.push(
        Bacon.combineWith(inDelta => {
          app.debug("got inDelta: ", inDelta)
          if (valueConfig.source && inDelta.$source !== valueConfig.source) {
            app.debug("skipping delta because source is wrong")
            return
          }
          val = inDelta.value
          // cache = cache + (val - cache) / count
          if (cache.length === valueConfig.period) {
            cache.shift()
          }
          cache.push(val)
          return calc(valueConfig.calc, cache)
        }, stream)
          // .changes()
          // .debounceImmediate(calculation.debounceDelay || 20)
          // .skipDuplicates(skip_function)
          .onValue(value => {
            if (value) {
              let outDelta = {
                // context: 'vessels.' + app.selfId,
                context: 'vessels.' + app.selfId,
                updates: [
                  {
                    values: [{ path: valueConfig.outputPath, value: value }]
                  }
                ]
              }
              app.debug("generated outDelta: ",outDelta)
              app.handleMessage(plugin.id, outDelta)
            }
          })
      )
    })
  }

  plugin.stop = function () {
    unsubscribes.forEach(f => f())
    unsubscribes = []
  }

  plugin.id = 'dejittered'
  plugin.name = 'Dejitter'
  plugin.description = 'Plugin that dejitters data'

  plugin.schema = {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        title: 'Values to average',
        default: [],
        items: {
          type: 'object',
          required: ['inputPath', 'outputPath', 'calc', 'period'],
          properties: {
            inputPath: {
              type: 'string',
              title: 'The path of the SignalK data to use.',
              default: 'navigation.speedOverGround',
            },
            outputPath: {
              type: 'string',
              title: 'The path of the SignalK data to create.',
              default: 'navigation.averageSpeedOverGround',
            },
            period: {
              type: 'integer',
              title: 'Calculation period in data frames (>0)',
              default: 5,
              minimum: 1
            },
            calc: {
              type: 'string',
              title: 'Calculation to apply',
              default: 'average',
              enum: ['average', 'min', 'max', 'radialAverage']
            },
            source: {
              type: 'string',
              title: 'Filter value for specific SignalK source',
              description: "(Optional - only if you have multiple sources and you want to use an explicit source)",
            }
          }
        }
      },
    }
  }



  return plugin
}

function calc(type, cache) {
  switch (type) {
    case 'average':
      return _.mean(cache)
    case 'radialAverage':
      const y = _.meanBy(cache, val => Math.sin(toRad(val)))
      const x = _.meanBy(cache, val => Math.cos(toRad(val)))
      return toDeg(Math.atan2(y,x))
    case 'max':
      return _.max(cache)
    case 'min':
      return _.min(cache)
  }
}

toDeg = (angle) => (angle * (180 / Math.PI))
toRad = (angle) => (angle * (Math.PI / 180))


