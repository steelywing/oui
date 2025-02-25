#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const countries = require("country-data").countries;
const fetch = require("fetch-enhanced")(require("node-fetch"));
const stringify = require("json-stable-stringify");

const stringifyOpts = {
  space: 1,
  cmp: (a, b) => {
    return parseInt(a.key, 16) > parseInt(b.key, 16) ? 1 : -1;
  },
};

module.exports = function update(opts) {
  return new Promise((resolve, reject) => {
    opts = {url: "https://standards-oui.ieee.org/oui/oui.txt",
      file: path.join(__dirname, "oui.json"), ...opts};

    const uri = url.parse(opts.url);
    if (!uri.protocol || !uri.hostname) {
      return reject(new Error(`Invalid source URL '${opts.url}'`));
    }

    fetch(opts.url).then(res => res.text()).then(body => {
      if (!body || !body.length || !/^(OUI|[#]|[A-Fa-f0-9])/.test(body)) {
        throw new Error("Downloaded file does not look like a oui.txt file");
      } else {
        return parse(body.split("\n"));
      }
    }).then(result => {
      if (opts.test) return resolve(result);

      // save oui.json
      fs.writeFile(opts.file, stringify(result, stringifyOpts), err => {
        if (err) return reject(err);
        resolve(result);
      });
    }).catch(reject);
  });
};

function isStart(firstLine, secondLine) {
  if (firstLine === undefined || secondLine === undefined) return false;
  return firstLine.trim().length === 0 && /([0-9A-F]{2}[-]){2}([0-9A-F]{2})/.test(secondLine);
}

function parse(lines) {
  const result = {};
  let i = 3;
  while (i !== lines.length) {
    if (isStart(lines[i], lines[i + 1])) {
      let oui = lines[i + 2].substring(0, 6).trim();
      let owner = lines[i + 1].replace(/\((hex|base 16)\)/, "").substring(10).trim();

      i += 3;
      while (!isStart(lines[i], lines[i + 1]) && i < lines.length) {
        if (lines[i] && lines[i].trim()) owner += `\n${lines[i].trim()}`;
        i++;
      }

      // ensure upper case on hex digits
      oui = oui.toUpperCase();

      // remove excessive whitespace
      owner = owner.replace(/[ \t]+/g, " ");

      // replace country shortcodes
      const shortCode = (/\n([A-Z]{2})$/.exec(owner) || [])[1];
      if (shortCode && countries[shortCode]) {
        owner = owner.replace(/\n.+$/, `\n${countries[shortCode].name}`);
      }

      result[oui] = owner;
    }
  }
  return result;
}
