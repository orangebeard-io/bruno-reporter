<h1 align="center">
  <a href="https://github.com/orangebeard-io/bruno-reporter">
    <img src="https://raw.githubusercontent.com/orangebeard-io/bruno-reporter/master/.github/logo.svg" alt="Orangebeard.io Bruno Reporter" height="200">
  </a>
  <br>Orangebeard.io Bruno Reporter<br>
</h1>

<h4 align="center">Report <a href="https://www.usebruno.com/" target="_blank" rel="noopener">Bruno</a> CLI JSON test results to Orangebeard.</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/@orangebeard-io/bruno-reporter">
    <img src="https://img.shields.io/npm/v/@orangebeard-io/bruno-reporter.svg?style=flat-square"
      alt="NPM Version" />
  </a>
  <a href="https://github.com/orangebeard-io/bruno-reporter/actions">
    <img src="https://img.shields.io/github/workflow/status/orangebeard-io/bruno-reporter/release?style=flat-square"
      alt="Build Status" />
  </a>
  <a href="https://github.com/orangebeard-io/bruno-reporter/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/orangebeard-io/bruno-reporter?style=flat-square"
      alt="License" />
  </a>
</p>

<div align="center">
  <h4>
    <a href="https://orangebeard.io">Orangebeard</a> |
    <a href="#installation">Installation</a> |
    <a href="#configuration">Configuration</a>
  </h4>
</div>

## Installation

### Install the npm package

```shell
npm install @orangebeard-io/bruno-reporter
```

## Configuration

Create `orangebeard.json` in your Bruno collection's folder (or above):

```JSON
{
  "endpoint": "https://app.orangebeard.io/organization",
  "accessToken": "00000000-0000-0000-0000-00000000", // prefer to store it in environment
  "project": "my_project_name",
  "testset": "My Test Set Name",
  "description": "Optional description",
  "attributes": [
    {
      "key": "Tool",
      "value": "Bruno"
    }
  ]
}
```

## Running

### 1. Generate a JSON report with Bruno CLI

Run your Bruno collection with the JSON reporter:

```shell
bru run --reporter-json results.json
```

### 2. Report the JSON results to Orangebeard

```shell
bruno-to-orangebeard -f results.json
```

Or using npm run:

```shell
npm run report -- -f results.json
```

## What gets reported

The reporter will:

- Create an Orangebeard test run from the Bruno JSON results.
- Derive the suite structure and test names from each result's `test.filename` (e.g. `Basic/ChuckNorris/ChuckNorris Facts.bru` → Suite: `Basic` / `ChuckNorris`, Test: `ChuckNorris Facts`).
- Log request and response metadata in Markdown, including headers and JSON/XML/text bodies in fenced code blocks.
- Map Bruno assertion results and test results to Orangebeard steps. Failed steps include the error message as an error log.
- Report top-level errors (e.g. missing modules, network failures) as error logs on the test.
- Support multiple iterations: when more than one iteration is present, test names are suffixed with the iteration number.
