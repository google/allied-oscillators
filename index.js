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

function generateUid() {
  if (!this.next_uid) {
    this.next_uid = 0;
  }
  return (this.next_uid++);
}

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

async function createVirtualKeyboard() {
  const keys =
        ['a','w','s','d','r','f','t','g','h','u','j','i','k','o','l',';','[',"'",']'];
  const isWhite =
        [ 1,  0,  1,  1,  0,  1,  0,  1,  1,  0,  1,  0,  1,  0,  1,  1,  0,  1,  0 ];

  const keyboard = document.getElementById("keyboard");
  keyboard.style.height = "100px";
  keyboard.style.width = "400px";
  keyboard.style.position = "relative";

  const numWhiteKeys = arraySum(isWhite);
  const keyWidth = (100 / numWhiteKeys);
  
  function arraySum(a) {
    function sum(a,b) {
      return a+b;
    }
    return a.reduce(sum, 0);
  }

  function keyLeft(i) {
    const numWhiteKeysBefore = arraySum(isWhite.slice(0,i));
    return (numWhiteKeysBefore * keyWidth) -
      (isWhite[i] ? 0 : (keyWidth/2));
  }
  
  const input = registerInput("Virtual keyboard");
  const channel = 0;
  
  function makeMIDIData(channel, key, velocity) {
    return [0x90 | channel, key, velocity];
  }
  
  function makeMouseDownHandler(key) {
    return function(e) {
      dispatchMIDI(input, makeMIDIData(channel, key, 64));
    };
  }

  function makeMouseUpHandler(key) {
    return function(e) {
      dispatchMIDI(input, makeMIDIData(channel, key, 0));
    };
  }

  function contextMenuHandler(e) {
    if(e.preventDefault != undefined) {
      e.preventDefault();
    }
    if(e.stopPropagation != undefined) {
      e.stopPropagation();
    }
    return false;
  }

  for (var i = 0; i < keys.length; ++i) {
    const key = document.createElement("div");
    keyboard.appendChild(key);

    const span = document.createElement("span");
    key.appendChild(span);

    const text = document.createTextNode(keys[i]);
    span.appendChild(text);

    key.style.position = "absolute";
    key.style.display = "flex";
    key.style.justifyContent = "center";
    key.style.alignItems = "flex-end";
    key.style.left = keyLeft(i).toString() + "%";
    key.style.bottom = isWhite[i] ? "0%" : "50%";
    key.style.height = isWhite[i] ? "100%" : "50%";
    key.style.width = keyWidth.toString() + "%";
    key.style.borderStyle = "solid";
    key.style.borderWidth = "thin";
    key.style.borderColor = isWhite[i] ? "black" : "white";
    key.style.color = isWhite[i] ? "black" : "white";
    key.style.backgroundColor = isWhite[i] ? "white" : "black";
    key.style.zIndex = isWhite[i] ? 0 : 1;

    const downHandler = makeMouseDownHandler(57 + i);
    const upHandler = makeMouseUpHandler(57+ i);

    key.addEventListener('mousedown', downHandler);
    key.addEventListener('mouseup', upHandler);
    key.addEventListener('touchstart', downHandler);
    key.addEventListener('touchend', upHandler);
    key.addEventListener('contextmenu', contextMenuHandler);
  }
    
  function keyDown(e) {
    if (event.isComposing || event.repeat || event.keyCode === 229) {
      return;
    }
    i = keys.findIndex(k => k == event.key);
    if (i == -1) {
      return;
    }
    dispatchMIDI(input, makeMIDIData(channel, 57 + i, 64));
  } 

  function keyUp(e) {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    i = keys.findIndex(k => k == event.key);
    if (i == -1) {
      return;
    }
    dispatchMIDI(input, makeMIDIData(channel, 57 + i, 0));
  } 

  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  
  return input;
}

async function createBuiltinSynth() {
  var audioCtx;
  var analyzer;
  var node;
  
  async function maybeInitializeWebAudio() {
    if (this.didInitializeWebAudio === true) {
      return;
    }
    this.didInitializeWebAudio = true;

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
      buffer = getStaticBuffer(bufferLength);
      analyzer.getByteFrequencyData(buffer);
      return buffer;
    } else {
      buffer = getStaticBuffer(1);
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

    sliceWidth = width * 1.0 / bufferLength;

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
  port = e.port;
  if (port.state == "connected") {
    registerWebMIDIPort(port);
  } else if (port.state == "disconnected") {
    unregisterWebMIDIPort(port);
  }
}

async function maybeInitializeWebMIDI() {
  var options = {};
  options.sysex = true;
  access = await navigator.requestMIDIAccess(options);
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

async function startup() {
  await maybeInitializeWebMIDI();
  const input = await createVirtualKeyboard();
  const output = await createBuiltinSynth();
}
