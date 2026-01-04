// Simple HTTP server using Windows Script Host
// Run with: cscript server.js

var http = require("http");
var fs = require("fs");
var path = require("path");

// This won't work in WSH, but let's try a different approach
