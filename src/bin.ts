#!/usr/bin/env node
import { parseArguments, runCli } from './cli.js'

try {
  runCli(parseArguments(process.argv.slice(2)))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
