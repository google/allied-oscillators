# Allied Oscillators

This project implements a Web-based UI for controlling MIDI synthesizers, as well as one or more VSTs that can be controlled by this UI.

## Getting Started

AO consist of
- one UI file (index.html)
- a driver JavaScript file (index.js)
- one or more other JavaScript files implementing VSTs.
You can try out AO by putting these files in one directory and opening index.html in a browser.

### Prerequisites

The browser requirements are:
- WebAudio
- WebMIDI
AO is tested on Google Chrome.

### Basic use

When you open index.html, click the "Connect" button.  This may trigger a browser notification because AO are requesting access to your MIDI devices.
Then you should be able to choose an input (such as the virtual keyboard) and output (such as a VST) and use the input to play notes on the output.

## Deployment

This project should be drop-in deployable on Firebase or similar Web hosting.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## License

This project is licensed under the Apache License, version 2.0 - see [LICENSE](LICENSE) for details
