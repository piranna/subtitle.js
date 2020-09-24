import { Node, Timestamp } from '..'
import { Parser } from './Parser'

export class ParserSRT extends Parser {
  protected expect = 'id'

  protected reTimestamp = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/
  protected reTimestampGroup = /^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$/

  public flush() {
    if (this.buffer.length > 0) {
      this.pushNode()
    }
  }

  protected getParsers() {
    return {
      id: this.parseId.bind(this),
      timestamp: this.parseTimestamp.bind(this),
      text: this.parseText.bind(this)
    }
  }

  protected parseId() {
    if (!this.isIndex(this.line)) {
      throw this.getError('number identifier')
    }

    this.expect = 'timestamp'
  }

  protected getTimestamps(line: string): Timestamp {
    const match = this.reTimestampGroup.exec(line)

    if (!match) {
      throw new Error('Invalid timestamp format')
    }

    const timestamp: Timestamp = {
      start: this.timestampToMilliseconds(match[1]),
      end: this.timestampToMilliseconds(match[2])
    }

    return timestamp
  }

  protected timestampToMilliseconds(timestamp: string): number {
    const match = timestamp.match(this.reTimestamp)

    if (!match) {
      throw new Error('Invalid timestamp')
    }

    const hours = match[1] ? parseInt(match[1], 10) * 3600000 : 0
    const minutes = parseInt(match[2], 10) * 60000
    const seconds = parseInt(match[3], 10) * 1000
    const milliseconds = parseInt(match[4], 10)

    return hours + minutes + seconds + milliseconds
  }

  protected parseTimestamp() {
    try {
      this.node = {
        type: 'cue',
        data: {
          ...this.getTimestamps(this.line),
          text: ''
        }
      }
    } catch (err) {
      throw this.getError('timestamp')
    }

    this.expect = 'text'
  }

  protected parseText() {
    if (this.buffer.length > 0 && this.isTimestamp(this.line)) {
      const lastIndex = this.buffer.length - 1

      if (this.isIndex(this.buffer[lastIndex])) {
        this.buffer.pop()
      }

      this.pushNode()
      this.parseTimestamp()
    } else {
      this.buffer.push(this.line)
    }
  }

  protected pushNode(): void {
    if (this.node.type === 'cue') {
      this.trimBuffer()
      this.node.data!.text = this.buffer.join('\n')
    }

    this.push(this.node as Node)
    this.reset()
  }

  protected isIndex(line: string): boolean {
    return /^\d+$/.test(line.trim())
  }

  private isTimestamp(line: string): boolean {
    return this.reTimestampGroup.test(line)
  }
}