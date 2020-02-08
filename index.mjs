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

export async function startup() {
  await maybeInitializeWebMIDI();
  
  const connectButton = document.getElementById("connect");
  connectButton.parentNode.removeChild(connectButton);

  const virtualKeyboardInput = registerInput("Virtual keyboard");
  const virtualKeyboard = await createVirtualKeyboard(
    document.getElementById("keyboard"),
    document.getElementById("controls"),
    function (midiData) {
      dispatchMIDI(virtualKeyboardInput, midiData);
    });

  const builtinSynthHandler =
    await createBuiltinSynth(document.getElementById("scope"));
  registerOutput("Bultin Synthesizer", builtinSynthHandler);
}
