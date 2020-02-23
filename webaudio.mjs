// Copyright 2020 Google LLC
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// jshint esversion: 8

var didInitialize = false;
var audioCtx = null;
var analyzer = null;

async function initialize() {
  if (didInitialize === true) {
    return;
  }
  didInitialize = true;

  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 512;
    analyzer.connect(audioCtx.destination);
  } catch (e) {
    console.log("Can't use WebAudio: " + e.toString());
  }
}

function connect(node) {
  node.connect(analyzer);
}

function disconnect(node) {
  node.disconnect(analyzer);
}

async function makeNode(js, class_name) {
  await initialize();

  try {
    await audioCtx.audioWorklet.addModule(js);
    return new AudioWorkletNode(audioCtx, class_name);
  } catch (e) {
    console.log("Can't load " + class_name + " from " + js + ": " + e.toString());
    return null;
  }
}


function getStaticBuffer_maker() {
  var sBuffer;
  var sLength = 0;

  return function(length) {
    if (!sBuffer || sLength != length) {
      sLength = length;
      sBuffer = new Uint8Array(sLength);
    }
    return sBuffer;
  };
}

const getStaticBuffer = getStaticBuffer_maker();

function getFFT() {
  if (analyzer) {
    const bufferLength = analyzer.frequencyBinCount;
    const buffer = getStaticBuffer(bufferLength);
    analyzer.getByteFrequencyData(buffer);
    return buffer;
  } else {
    const buffer = getStaticBuffer(1);
    buffer[0] = 0;
    return buffer;
  }
}

export const audio = {
  'makeNode' : makeNode,
  'connect': connect,
  'disconnect' : disconnect,
  'getFFT' : getFFT
};
