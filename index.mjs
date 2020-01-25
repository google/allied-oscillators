// Copyright 2019 Google LLC
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

function generateUid_maker() {
  var next_uid = 0;
  return function() {
    return (next_uid++);
  }
}

const generateUid = generateUid_maker();

const input_select = document.getElementById("input");
const output_select = document.getElementById("output");

function registerInput(name) {
  const input = document.createElement("option");
  input.innerHTML = name;
  input.uid = generateUid();
  input_select.options.add(input);
  return input.uid;
}

function removeFromSelect(select, uid) {
  for (i = 0; i < select.options.length; ++i) {
    if (select.options[i].uid == uid) {
      select.options.remove(i);
      return;
    }
  }
}

function unregisterInput(uid) {
  removeFromSelect(input_select, uid);
}

function unregisterOutput(uid) {
  removeFromSelect(output_select, uid);
}

function registerOutput(name, fn) {
  const output = document.createElement("option");
  output.innerHTML = name;
  output.uid = generateUid();
  output.fn = fn;
  output_select.options.add(output);
  return output.uid;
}

function dispatchMIDI(input_uid, data) {
  if (input_select.options.length && input_select.selectedIndex >= 0 &&
      output_select.options.length && output_select.selectedIndex >= 0 &&
      input_select.options[input_select.selectedIndex].uid == input_uid) {
    output_select.options[output_select.selectedIndex].fn(data);
  }
}

import { createVirtualKeyboard } from './keyboard.mjs';

async function createBuiltinSynth() {
  var audioCtx;
  var analyzer;
  var node;
  
  var didInitializeWebAudio = false;

  async function maybeInitializeWebAudio() {
    if (didInitializeWebAudio === true) {
      return;
    }
    didInitializeWebAudio = true;

    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      await audioCtx.audioWorklet.addModule("sinusoid-vst.js");

      analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 512;
      analyzer.connect(audioCtx.destination);

      const sinusoidNode = new AudioWorkletNode(audioCtx, "sinusoid-processor");
      sinusoidNode.connect(analyzer);
      node = sinusoidNode;
    } catch (e) {
      document.getElementById("connect").innerHTML =
        "Can't use WebAudio: " + e.toString();
      console.log("Can't use WebAudio: " + e.toString());
    }
  }
  
  await maybeInitializeWebAudio();
  
  function handleMIDIMessage(data) {
    if (data.length === 0) {
      return;
    }
    if (data[0] === 0xf8) {
      // timing
      return;
    }
    if (data[0] === 0xfe) {
      // line is active
      return;
    }
    if ((data[0] & 0xf0) === 0x90) {
      if (data.length != 3) {
        return;
      }
      if (node != null) {
        node.port.postMessage(data);
      }
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
  
  function getBuffer() {
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

  function draw() {
    const canvas = document.getElementById("scope");
    const canvasCtx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    canvasCtx.clearRect(0, 0, width, height);

    requestAnimationFrame(draw);

    const buffer = getBuffer(); 
    const bufferLength = buffer.length;

    const sliceWidth = width * 1.0 / bufferLength;

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";
    canvasCtx.beginPath();

    function toY(v) {
      return height - v * height / 256.0;
    }

    var x = 0;
    for (var i = 0; i < bufferLength; ++i, x += sliceWidth) {
      var y = toY(buffer[i]);

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
    }
    canvasCtx.lineTo(x, toY(buffer[i - 1]));

    canvasCtx.stroke();
  }

  requestAnimationFrame(draw);
  return registerOutput("Builtin Synthesizer", handleMIDIMessage);
}

function registerWebMIDIPort(port) {
  if ('uid' in port) {
    return;
  }
  
  if (port.type == "input") {
    port.uid = registerInput(port.name);
    const uid = port.uid;
    port.onmidimessage = function (e) {
      dispatchMIDI(uid, e.data);
    };
  } else if (port.type == "output") {
    port.uid = registerOutput(port.name, function (data) {
      port.send(data);
    });
  }
}

function unregisterWebMIDIPort(port) {
  if (port.type == "input") {
    unregisterInput(port.uid);
    delete port.uid;
  } else if (port.type == "output") {
    unregisterOutput(port.uid);
    delete port.uid;
  }
}

function onWebMIDIStateChange(e) {
  const port = e.port;
  if (port.state == "connected") {
    registerWebMIDIPort(port);
  } else if (port.state == "disconnected") {
    unregisterWebMIDIPort(port);
  }
}

async function maybeInitializeWebMIDI() {
  var options = {};
  options.sysex = true;
  const access = await navigator.requestMIDIAccess(options);
  if (!(access instanceof MIDIAccess)) {
    return;
  }
  for (let port of access.inputs.values()) {
    registerWebMIDIPort(port);
  }
  for (let port of access.outputs.values()) {
    registerWebMIDIPort(port);
  }
  access.onstatechange = onWebMIDIStateChange;
}

export async function startup() {
  await maybeInitializeWebMIDI();
  
  const virtualKeyboardInput = registerInput("Virtual keyboard");
  const virtualKeyboard = await createVirtualKeyboard(
    document.getElementById("keyboard"),
    function (midiData) {
      dispatchMIDI(virtualKeyboardInput, midiData);
    });
  const output = await createBuiltinSynth();
}
