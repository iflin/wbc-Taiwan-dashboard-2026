const fs = require('fs');
global.window = {}; // mock window
global.d3 = require('d3'); // if needed
require('./src/dataProcessor.js');

const DataProcessor = window.DataProcessor;

// mock allGamesData
const d3_dsv = require('d3-dsv'); // this failed earlier without install, but I don't need dsv.
// I'll just load the JSON data directly if there's any JSON?
// Let me use fetch logic or read the CSVs using vanilla JS.

