/* 
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import { expect } from '@jest/globals'
import config from 'config'
import { initialize, bot } from '../../routes/chatbot'
import fs from 'fs/promises'
import * as utils from '../../lib/utils'

const URL = 'http://localhost:3000'
const REST_URL = `${URL}/rest/`
const API_URL = `${URL}/api/`
let trainingData: { data: any[] }

// Helper function to login and return the token
async function login({ email, password }: { email: string; password: string }): Promise<string> {
  const loginRes = await frisby
    .post(REST_URL + '/user/login', {
      body: { email, password },
      headers: { 'Content-Type': 'application/json' }
    })
    .expect('status', 200)
    .promise()

  return loginRes.json.authentication.token
}

// Helper function to send a chatbot query
async function postChatbotQuery(token: string, query: string, action: string = 'query') {
  return frisby
    .post(REST_URL + 'chatbot/respond', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: { action, query }
    })
    .promise()
}

describe('/chatbot', () => {
  beforeAll(async () => {
    await initialize()
    trainingData = JSON.parse(
      await fs.readFile(`data/chatbot/${utils.extractFilename(config.get('application.chatBot.trainingData'))}`, { encoding: 'utf8' })
    )
  })

  describe('/status', () => {
    it('GET bot training state', () => {
      return frisby.get(REST_URL + 'chatbot/status').expect('status', 200).expect('json', 'status', true)
    })

    it('GET bot state for anonymous users contains log in request', () => {
      return frisby.get(REST_URL + 'chatbot/status').expect('status', 200).expect('json', 'body', /Sign in to talk/)
    })

    it('GET bot state for authenticated users contains request for username', async () => {
      const token = await login({
        email: `J12934@${config.get<string>('application.domain')}`,
        password: '0Y8rMnww$*9VFYE§59-!Fg1L6t&6lB'
      })

      await frisby
        .setup({
          request: { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        })
        .get(REST_URL + 'chatbot/status')
        .expect('status', 200)
        .expect('json', 'body', /What shall I call you?/)
        .promise()
    })
  })

  describe('/respond', () => {
    it('Asks for username if not defined', async () => {
      const token = await login({
        email: `J12934@${config.get<string>('application.domain')}`,
        password: '0Y8rMnww$*9VFYE§59-!Fg1L6t&6lB'
      })

      const testCommand = trainingData.data[0].utterances[0]

      const response = await postChatbotQuery(token, testCommand)
      expect(response.status).toBe(200)
      expect(response.json.action).toBe('namequery')
      expect(response.json.body).toBe("I'm sorry I didn't get your name. What shall I call you?")
    })

    it('Returns greeting if username is defined', async () => {
      if (!bot) throw new Error('Bot not initialized')

      const token = await login({
        email: 'bjoern.kimminich@gmail.com',
        password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI='
      })
      bot.addUser('1337', 'bkimminich')
      const testCommand = trainingData.data[0].utterances[0]

      const response = await postChatbotQuery(token, testCommand)
      expect(response.status).toBe(200)
      expect(response.json.action).toBe('response')
      expect(response.json.body).toContain(bot.greet('1337'))
    })

    it('Responds with product price when asked question with product name', async () => {
      const token = await login({
        email: 'bjoern.kimminich@gmail.com',
        password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI='
      })
      const productResponse = await frisby.get(API_URL + '/Products/1').expect('status', 200).promise()
      const product = productResponse.json.data

      const response = await postChatbotQuery(token, `How much is ${product.name}?`)
      expect(response.status).toBe(200)
      expect(response.json.action).toBe('response')
      expect(response.json.body).toContain(`${product.name} costs ${product.price}¤`)
    })

    it('Greets back registered user after being told username', async () => {
      const token = await login({
        email: `stan@${config.get<string>('application.domain')}`,
        password: 'ship coffin krypt cross estate supply insurance asbestos souvenir'
      })

      const response = await postChatbotQuery(token, 'NotGuybrushThreepwood', 'setname')
      expect(response.status).toBe(200)
      expect(response.json.action).toBe('response')
      expect(response.json.body).toContain('NotGuybrushThreepwood')
    })

    it('POST returns error for unauthenticated user', async () => {
      const testCommand = trainingData.data[0].utterances[0]

      const response = await frisby
        .post(REST_URL + 'chatbot/respond', {
          headers: { Authorization: 'Bearer faketoken', 'Content-Type': 'application/json' },
          body: { query: testCommand }
        })
        .promise()

      expect(response.status).toBe(401)
      expect(response.json.error).toBe('Unauthenticated user')
    })

    it('Returns a 500 when the user name is set to crash request', async () => {
      const userEmail = `chatbot-testuser@${config.get<string>('application.domain')}`
      await frisby.post(`${API_URL}/Users`, {
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: userEmail,
          password: 'testtesttest',
          username: '"',
          role: 'admin'
        }
      }).promise()

      const token = await login({ email: userEmail, password: 'testtesttest' })
      const functionTest = trainingData.data.filter((data) => data.intent === 'queries.functionTest')
      const testCommand = functionTest[0].utterances[0]

      const response = await postChatbotQuery(token, testCommand)
      expect(response.status).toBe(500)
    })
  })
})
