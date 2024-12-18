/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { environment } from '../../environments/environment'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { catchError, map } from 'rxjs/operators'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly hostServer = environment.hostServer
  private readonly host = this.hostServer + '/rest/chatbot'

  constructor (private readonly http: HttpClient) { }

  getChatbotStatus (): Observable<{ status: boolean, body: string }> {
    return this.http.get<{ status: boolean, body: string }>(this.host + '/status').pipe(map((response: { status: boolean, body: string }) => response), catchError((error: Error) => { throw error }))
  }

  getResponse (action: string, query: string): Observable<{ action: string, body: string }> {
    return this.http.post<{ action: string, body: string }>(this.host + '/respond', { action, query }).pipe(map((response: { action: string, body: string }) => response), catchError((error: Error) => { throw error }))
  }
}
