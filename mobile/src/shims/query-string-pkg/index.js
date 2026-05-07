"use strict";

// Minimal query-string shim — only `parse` and `stringify` are used by
// @react-navigation/core. Compatible behavior with query-string@7. No external
// deps so Metro bundles it cleanly without pnpm symlink resolution issues.

function encode(value) {
  return encodeURIComponent(String(value));
}

function decode(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function parse(input) {
  const result = Object.create(null);
  if (typeof input !== "string") return result;
  const str = input.trim().replace(/^[?#&]/, "");
  if (!str) return result;
  for (const part of str.split("&")) {
    if (!part) continue;
    const eqIdx = part.indexOf("=");
    let key;
    let val;
    if (eqIdx === -1) {
      key = decode(part);
      val = null;
    } else {
      key = decode(part.slice(0, eqIdx));
      val = decode(part.slice(eqIdx + 1));
    }
    if (result[key] === undefined) {
      result[key] = val;
    } else if (Array.isArray(result[key])) {
      result[key].push(val);
    } else {
      result[key] = [result[key], val];
    }
  }
  return result;
}

function stringify(obj) {
  if (!obj) return "";
  const parts = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    if (value === null) {
      parts.push(encode(key));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined) continue;
        parts.push(
          item === null ? encode(key) : encode(key) + "=" + encode(item),
        );
      }
    } else {
      parts.push(encode(key) + "=" + encode(value));
    }
  }
  return parts.join("&");
}

module.exports.parse = parse;
module.exports.stringify = stringify;
