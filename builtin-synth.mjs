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
import { audio } from './webaudio.mjs';

export async function createBuiltinSynth(js, class_name) {
  const node = await audio.makeNode(js, class_name);
  if (node == null) {
    return null;
  }

  let active = false;

  function updateActive(data) {
    if (active) {
      if (midi.isAllSoundOff(data)) {
        audio.disconnect(node);
        active = false;
      }
    } else {
      if (midi.isKeyMessage(data)) {
        audio.connect(node);
        active = true;
      }
    }
  }

  function handleMIDIMessage(data) {
    updateActive(data);
    if (midi.isKeyMessage(data) ||
        midi.isControlMessage(data)) {
      if (node != null) {
        node.port.postMessage(data);
      }
    }
  }

  return handleMIDIMessage;
}
