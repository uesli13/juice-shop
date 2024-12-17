/* 
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import { expect } from '@jest/globals'
import config from 'config'
import path from 'path'
const fs = require('fs')

const jsonHeader = { 'content-type': 'application/json' }
const REST_URL = 'http://localhost:3000/rest'

// Helper function for user login
function loginUser(email: string, password: string) {
  return frisby.post(REST_URL + '/user/login', {
    headers: jsonHeader,
    body: { email, password }
  }).expect('status', 200)
}

// Helper function to post a memory
function postMemory(token: string, filePath: string, caption: string, expectedStatus: number) {
  const file = path.resolve(__dirname, filePath)
  const form = frisby.formData()
  form.append('image', fs.createReadStream(file), caption)
  form.append('caption', caption)

  return frisby.post(REST_URL + '/memories', {
    headers: {
      Authorization: 'Bearer ' + token,
      // @ts-expect-error FIXME form.getHeaders() is not found
      'Content-Type': form.getHeaders()['content-type']
    },
    body: form
  }).expect('status', expectedStatus)
}

describe('/rest/memories', () => {
  it('GET memories via public API', () => {
    return frisby.get(REST_URL + '/memories')
      .expect('status', 200)
  })

  it('GET memories via a valid authorization token', () => {
    return loginUser('jim@' + config.get<string>('application.domain'), 'ncc-1701')
      .then(({ json: jsonLogin }) => {
        return frisby.get(REST_URL + '/memories', {
          headers: { Authorization: 'Bearer ' + jsonLogin.authentication.token, 'content-type': 'application/json' }
        }).expect('status', 200)
      })
  })

  it('POST new memory is forbidden via public API', () => {
    const file = path.resolve(__dirname, '../files/validProfileImage.jpg')
    const form = frisby.formData()
    form.append('image', fs.createReadStream(file), 'Valid Image')
    form.append('caption', 'Valid Image')

    return frisby.post(REST_URL + '/memories', {
      headers: {
        // @ts-expect-error FIXME form.getHeaders() is not found
        'Content-Type': form.getHeaders()['content-type']
      },
      body: form
    }).expect('status', 401)
  })

  it('POST new memory image file invalid type', () => {
    return loginUser('jim@' + config.get<string>('application.domain'), 'ncc-1701')
      .then(({ json: jsonLogin }) => {
        return postMemory(
          jsonLogin.authentication.token,
          '../files/invalidProfileImageType.docx',
          'Invalid Image',
          500
        )
      })
  })

  it('POST new memory with valid JPG format image', () => {
    return loginUser('jim@' + config.get<string>('application.domain'), 'ncc-1701')
      .then(({ json: jsonLogin }) => {
        return postMemory(
          jsonLogin.authentication.token,
          '../files/validProfileImage.jpg',
          'Valid Image',
          200
        ).then(({ json }) => {
          expect(json.data.caption).toBe('Valid Image')
          expect(json.data.UserId).toBe(2)
        })
      })
  })

  it('Should not crash the node-js server when sending invalid content like described in CVE-2022-24434', () => {
    return frisby.post(REST_URL + '/memories', {
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryoo6vortfDzBsDiro',
        'Content-Length': '145'
      },
      body: '------WebKitFormBoundaryoo6vortfDzBsDiro\r\n Content-Disposition: form-data; name="bildbeschreibung"\r\n\r\n\r\n------WebKitFormBoundaryoo6vortfDzBsDiro--'
    })
      .expect('status', 500)
      .expect('bodyContains', 'Error: Malformed part header')
  })
})
