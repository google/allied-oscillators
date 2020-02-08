// Copyright 2019-2020 Google LLC
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
//
import { midi } from './midiutils.mjs';

export async function createBuiltinSynth(canvas) {
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
      console.log("Can't use WebAudio: " + e.toString());
    }
  }
  
  await maybeInitializeWebAudio();
  
  function handleMIDIMessage(data) {
    if (midi.isKeyMessage(data) ||
        midi.isControlMessage(data)) {
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
  return handleMIDIMessage;
}
