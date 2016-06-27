require('es6-promise').polyfill()

import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { ping } from './ping'
import Queue from 'promise-queue'
import ReactSlider from 'react-slider'
import _ from 'lodash'
import GreatCircle from 'great-circle'
import weightedMean from 'weighted-mean'

import { GoogleMap, GoogleMapLoader, Circle, Marker } from "react-google-maps"

const state = {
  servers: require('./servers'),
  pinged: [],
  queued: [],
  multipier: 500000,
  guess: { lat: 0, lng: 0 }
}

const styles = [{"featureType":"administrative","elementType":"labels.text.fill","stylers":[{"color":"#444444"}]},{"featureType":"landscape","elementType":"all","stylers":[{"color":"#f2f2f2"}]},{"featureType":"poi","elementType":"all","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"all","stylers":[{"saturation":-100},{"lightness":45}]},{"featureType":"road.highway","elementType":"all","stylers":[{"visibility":"simplified"}]},{"featureType":"road.arterial","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"transit","elementType":"all","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"all","stylers":[{"color":"#46bcec"},{"visibility":"on"}]}]

function GeoMap({ multipier, servers }) {
  return(<GoogleMapLoader
    containerElement={
      <div
        style={{
          height: window.innerHeight,
          width: window.innerWidth
        }}
      />
    }
    googleMapElement={
      <GoogleMap
        defaultZoom={2}
        defaultOptions={{ styles }}
        defaultCenter={{ lat: 0, lng: 0 }}>
        {
          [state.guess].map(server =>
            <Circle
            key={server.ip}
            center={{lat: server.lat, lng: server.lng}}
            radius={multipier*server.ping / 100}
            options={{
              fillColor: `red`,
              fillOpacity: 0.20,
              strokeColor: `red`,
              strokeOpacity: 1,
              strokeWeight: 1
            }} />
          )
        }
        </GoogleMap>
    }
  />)
}

var queue = new Queue(1, Infinity)

function App({ servers, multipier }) {
  return (<div>
    <GeoMap multipier={multipier} servers={servers} />
  </div>)
}

function scheduleClosest(server) {
  var touched = state.queued.concat(state.pinged)
  var notPinged = _.filter(state.servers, s => touched.indexOf(s) === -1)

  function distance2(server) {
    return GreatCircle.distance(server.lat, server.lng, state.pinged[0].lat, state.pinged[0].lng, 'KM');
  }

  var best = state.pinged.slice(0, 5)

  if (best.length > 0) {
    var lats = best.map(s => [s.lat, 100 / (s.ping - state.pinged[0].ping + 100)])
    var lngs = best.map(s => [s.lng, 100 / (s.ping - state.pinged[0].ping + 100)])
    state.guess = { lat: weightedMean(lats), lng: weightedMean(lngs), ping: best[0].ping }
  }

  function distance(server) {
    return GreatCircle.distance(server.lat, server.lng, state.guess.lat, state.guess.lng, 'KM');
  }

  var closestNotPinged = _.minBy(notPinged, distance)

  if (distance(closestNotPinged) < 1000) {
    schedulePing(closestNotPinged)
  }

  setTimeout(function () {
    if (state.pinged.indexOf(server) >= 0 && state.pinged.indexOf(server) <= 6) {
      schedulePing(server)
    }
  }, 10000)
}

function schedulePing(server) {
  state.queued.push(server)
}

function workNext() {
  var server = state.queued.shift()

  if (server) {
    queue.add(function () {
      return ping('http://' + server.ip).then(function (delta) {
        server.ping = delta
        state.pinged = _.sortBy(_.filter(state.servers, 'ping'), 'ping')
        render()
        state.queued.splice(state.queued.indexOf(server), 1)
        scheduleClosest(server)
        workNext()
      }).catch(function (e) {
        console.log(e)
        workNext()
      })
    })
  } else {
    setTimeout(function () {
      workNext()
    }, 1000)
  }
}


function render() {
  ReactDOM.render(<App {...state }/>, document.getElementById('react-root'))
}

render()

_.sampleSize(state.servers, 20).forEach(schedulePing)

workNext()
