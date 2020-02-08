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

import { midi } from './midiutils.mjs';

export async function createControls(controls, dispatch) {
  controls.style.height = "150px";
  controls.style.width = "400px";
  controls.style.position = "relative";
  controls.style.backgroundColor = "#c0c0c0";

  const known_names = {
    [73] : 'attack',
    [75] : 'decay',
    [79] : 'sustain',
    [72] : 'release'
  };

  const builtins = [
    73, 75, 79, 72
  ];

  const values = {
    [73] : 16,
    [75] : 16,
    [79] : 64,
    [72] : 16
  };

  for (let i = 0; i < builtins.length; ++i) {
    const control = document.createElement("div");
    controls.appendChild(control);
    control.style.display = "flex";
    control.style.flexDirection = "row";

    const id = document.createElement("input");
    id.type = "number";
    id.style.width = "50px";
    id.min = 0;
    id.max = 127;
    id.step = 1;
    id.value = builtins[i];

    const nameDiv = document.createElement("div");
    nameDiv.style.width = "100px";
    const name = document.createElement("span");
    nameDiv.style.textAlign = "center";
    nameDiv.appendChild(name);

    const range = document.createElement("input");
    range.type = "range";
    range.style.width = "200px";
    range.style.flexGrow = 1;
    range.min = 0;
    range.max = 127;
    range.step = 1;
    range.value = 0;

    const _dispatch = dispatch; // shuts up jshint
    const _midi = midi; // shuts up jshint
    const changeRange = function(e) {
      const range_value = parseInt(range.value);
      const id_number = parseInt(id.value);
      values[id_number] = range.value;
      _dispatch(_midi.controlMessage(id_number, range_value));
    };

    const _document = document; // shuts up jshint
    const changeId = function(e) {
      const id_number = id.value;
      while (name.firstChild) {
        name.removeChild(name.firstChild);
      }
      if (id_number in known_names) {
        let nameText = _document.createTextNode(known_names[id_number]);
        name.appendChild(nameText);
      }
      if (!(id_number in values)) {
        values[id_number] = 0;
      }
      range.value = values[id_number];
      changeRange({});
    };

    id.addEventListener("change", changeId);
    range.addEventListener("change", changeRange);
    changeId({});

    control.appendChild(id);
    control.appendChild(nameDiv);
    control.appendChild(range);
  }
}
