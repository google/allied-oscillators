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

import {
  maybeInitializeWebMIDI,
  dispatchMIDI,
  registerInput,
  registerOutput
} from './webmidi.mjs';
import { createVirtualKeyboard } from './keyboard.mjs';
import { createBuiltinSynth } from './builtin-synth.mjs';
import { audio } from './webaudio.mjs';

function draw() {
  const canvas = document.getElementById("scope");
  const canvasCtx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  canvasCtx.clearRect(0, 0, width, height);

  requestAnimationFrame(draw);

  const buffer = audio.getFFT(); 
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
    const y = toY(buffer[i]);

    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  }
  canvasCtx.lineTo(x, toY(buffer[i - 1]));

  canvasCtx.stroke();
}

export async function startup() {
  await maybeInitializeWebMIDI();
  
  const connectButton = document.getElementById("connect");
  connectButton.parentNode.removeChild(connectButton);

  const virtualKeyboardInput = registerInput("Virtual keyboard", true);
  const virtualKeyboard = await createVirtualKeyboard(
    document.getElementById("keyboard"),
    document.getElementById("controls"),
    function(midiData) {
      dispatchMIDI(virtualKeyboardInput, midiData);
    });

  const sinusoidHandler =
    await createBuiltinSynth(
      "sinusoid-vst.js", "sinusoid-vst");

  if (sinusoidHandler) {
    registerOutput("Builtin Sinusoid", sinusoidHandler, true);
  }

  requestAnimationFrame(draw);
}
