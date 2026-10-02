import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citiesFor, COUNTRIES, isKnownCountry, regionsFor } from "../lib/geo";

describe("COUNTRIES", () => {
  it("has a realistic number of countries", () => {
    assert.ok(
      COUNTRIES.length > 180,
      `expected a full country list, got ${COUNTRIES.length}`,
    );
  });

  it("resolves codes to readable names", () => {
    const nigeria = COUNTRIES.find((country) => country.code === "NG");
    assert.equal(nigeria?.name, "Nigeria");
  });

  it("is sorted alphabetically by name", () => {
    const names = COUNTRIES.map((country) => country.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    assert.deepEqual(names, sorted);
  });

  it("has no duplicate codes", () => {
    const codes = COUNTRIES.map((country) => country.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("has no duplicate names", () => {
    const names = COUNTRIES.map((country) => country.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("never falls back to a bare code for the countries we ship regions for", () => {
    for (const expected of [
      "Nigeria",
      "United States",
      "Canada",
      "United Kingdom",
    ]) {
      assert.ok(
        COUNTRIES.some((country) => country.name === expected),
        `${expected} should be present under that exact name`,
      );
    }
  });
});

describe("isKnownCountry", () => {
  it("accepts a listed country", () => {
    assert.equal(isKnownCountry("Nigeria"), true);
    assert.equal(isKnownCountry("United States"), true);
  });

  it("tolerates surrounding whitespace", () => {
    assert.equal(isKnownCountry("  Nigeria  "), true);
  });

  it("rejects anything not on the list", () => {
    assert.equal(isKnownCountry("Wakanda"), false);
    assert.equal(isKnownCountry(""), false);
    assert.equal(isKnownCountry("NG"), false);
  });

  it("is case sensitive, matching the option values exactly", () => {
    assert.equal(isKnownCountry("nigeria"), false);
  });
});

describe("regionsFor", () => {
  it("returns all 36 Nigerian states plus the FCT", () => {
    const states = regionsFor("Nigeria");
    assert.equal(states.length, 37);
    assert.ok(states.includes("Lagos"));
    assert.ok(states.includes("Federal Capital Territory"));
  });

  it("returns the 50 US states plus DC", () => {
    assert.equal(regionsFor("United States").length, 51);
  });

  it("returns Canadian provinces and territories", () => {
    assert.equal(regionsFor("Canada").length, 13);
  });

  it("returns the four UK nations", () => {
    assert.deepEqual(regionsFor("United Kingdom"), [
      "England",
      "Northern Ireland",
      "Scotland",
      "Wales",
    ]);
  });

  it("returns an empty list for a country we have no data for", () => {
    // The form falls back to a free text input on an empty list.
    assert.deepEqual(regionsFor("France"), []);
  });

  it("returns an empty list for an empty or unknown country", () => {
    assert.deepEqual(regionsFor(""), []);
    assert.deepEqual(regionsFor("Wakanda"), []);
  });

  it("tolerates surrounding whitespace", () => {
    assert.equal(regionsFor("  Nigeria  ").length, 37);
  });

  it("has sorted, duplicate-free lists", () => {
    for (const country of ["Nigeria", "United States", "Canada"]) {
      const regions = regionsFor(country);
      assert.equal(new Set(regions).size, regions.length, `${country} has duplicates`);
      assert.deepEqual(
        regions,
        [...regions].sort((a, b) => a.localeCompare(b, "en")),
        `${country} is not sorted`,
      );
    }
  });
});

describe("citiesFor", () => {
  it("returns cities for a Nigerian state", () => {
    const lagos = citiesFor("Nigeria", "Lagos");
    assert.ok(lagos.includes("Ikeja"));
    assert.ok(lagos.includes("Victoria Island"));
  });

  it("covers every Nigerian state with at least three cities", () => {
    for (const state of regionsFor("Nigeria")) {
      const cities = citiesFor("Nigeria", state);
      assert.ok(
        cities.length >= 3,
        `${state} has only ${cities.length} cities`,
      );
    }
  });

  it("returns an empty list for a country without city data", () => {
    assert.deepEqual(citiesFor("United States", "California"), []);
  });

  it("returns an empty list for an unknown state", () => {
    assert.deepEqual(citiesFor("Nigeria", "Atlantis"), []);
  });

  it("returns an empty list when the region is blank", () => {
    assert.deepEqual(citiesFor("Nigeria", ""), []);
  });

  it("tolerates surrounding whitespace", () => {
    assert.ok(citiesFor("  Nigeria  ", "  Lagos  ").length > 0);
  });

  it("has duplicate-free city lists", () => {
    for (const state of regionsFor("Nigeria")) {
      const cities = citiesFor("Nigeria", state);
      assert.equal(new Set(cities).size, cities.length, `${state} has duplicates`);
    }
  });
});
