/* 
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import { expect } from '@jest/globals'
import config from 'config'

const REST_URL = 'http://localhost:3000/rest'
const API_URL = 'http://localhost:3000/api'

const jsonHeader = { 'content-type': 'application/json' }

// Helper function for login and making a request
function loginAndRequest(email: string, password: string, method: 'get' | 'post' | 'put' | 'delete', url: string, body: any = null, expectedStatus: number) {
  return frisby.post(`${REST_URL}/user/login`, {
    headers: jsonHeader,
    body: {
      email: `${email}@${config.get<string>('application.domain')}`,
      password
    }
  })
    .expect('status', 200)
    .then(({ json }) => {
      const options: any = {
        headers: { Authorization: `Bearer ${json.authentication.token}`, 'content-type': 'application/json' }
      }
      if (body) options.body = body
      return frisby[method](url, options).expect('status', expectedStatus)
    })
}

describe('/api/Quantitys', () => {
  it('GET quantity of all items for customers', () => {
    return loginAndRequest('jim', 'ncc-1701', 'get', `${API_URL}/Quantitys`, null, 200)
  })

  it('GET quantity of all items for admin', () => {
    return loginAndRequest('admin', 'admin123', 'get', `${API_URL}/Quantitys`, null, 200)
  })

  it('GET quantity of all items for accounting users', () => {
    return loginAndRequest('accountant', 'i am an awesome accountant', 'get', `${API_URL}/Quantitys`, null, 200)
  })

  it('POST quantity is forbidden for customers', () => {
    return loginAndRequest('jim', 'ncc-1701', 'post', `${API_URL}/Quantitys`, { ProductId: 1, quantity: 100 }, 401)
  })

  it('POST quantity forbidden for admin', () => {
    return loginAndRequest('admin', 'admin123', 'post', `${API_URL}/Quantitys`, { ProductId: 1, quantity: 100 }, 401)
  })

  it('POST quantity is forbidden for accounting users', () => {
    return loginAndRequest('accountant', 'i am an awesome accountant', 'post', `${API_URL}/Quantitys`, { ProductId: 1, quantity: 100 }, 401)
  })
})

describe('/api/Quantitys/:ids', () => {
  it('GET quantity of all items is forbidden for customers', () => {
    return loginAndRequest('jim', 'ncc-1701', 'get', `${API_URL}/Quantitys/1`, null, 403)
      .expect('json', 'error', 'Malicious activity detected')
  })

  it('GET quantity of all items is forbidden for admin', () => {
    return loginAndRequest('admin', 'admin123', 'get', `${API_URL}/Quantitys/1`, null, 403)
      .expect('json', 'error', 'Malicious activity detected')
  })

  it('GET quantity of all items for accounting users blocked by IP filter', () => {
    return loginAndRequest('accountant', 'i am an awesome accountant', 'get', `${API_URL}/Quantitys/1`, null, 403)
  })

  xit('GET quantity of all items for accounting users from IP 123.456.789', () => { // TODO Check if possible to set IP in frisby tests
    return loginAndRequest('accountant', 'i am an awesome accountant', 'get', `${API_URL}/Quantitys/1`, null, 200)
  })

  it('PUT quantity is forbidden for customers', () => {
    return loginAndRequest('jim', 'ncc-1701', 'put', `${API_URL}/Quantitys/1`, { quantity: 100 }, 403)
      .expect('json', 'error', 'Malicious activity detected')
  })

  it('PUT quantity is forbidden for admin', () => {
    return loginAndRequest('jim', 'ncc-1701', 'put', `${API_URL}/Quantitys/1`, { quantity: 100 }, 403)
      .expect('json', 'error', 'Malicious activity detected')
  })

  it('PUT quantity as accounting user blocked by IP filter', () => {
    return loginAndRequest('accountant', 'i am an awesome accountant', 'put', `${API_URL}/Quantitys/1`, { quantity: 100 }, 403)
  })

  xit('PUT quantity as accounting user from IP 123.456.789', () => { // TODO Check if possible to set IP in frisby tests
    return loginAndRequest('accountant', 'i am an awesome accountant', 'put', `${API_URL}/Quantitys/1`, { quantity: 100 }, 200)
      .then(({ json }) => {
        expect(json.data.quantity).toBe(100)
      })
  })

  it('DELETE quantity is forbidden for accountant', () => {
    return loginAndRequest('accountant', 'i am an awesome accountant', 'delete', `${API_URL}/Quantitys/1`, null, 401)
  })

  it('DELETE quantity is forbidden for admin', () => {
    return loginAndRequest('admin', 'admin123', 'delete', `${API_URL}/Quantitys/1`, null, 401)
  })

  it('DELETE quantity is forbidden for users', () => {
    return loginAndRequest('jim', 'ncc-1701', 'delete', `${API_URL}/Quantitys/1`, null, 401)
  })
})
