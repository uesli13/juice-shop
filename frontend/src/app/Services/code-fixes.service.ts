import { Injectable } from '@angular/core'
import { environment } from '../../environments/environment'
import { HttpClient } from '@angular/common/http'
import { catchError, map } from 'rxjs/operators'
import { type Observable } from 'rxjs'

export interface result {
  verdict: boolean
}

export interface Fixes {
  fixes: string[]
}

export interface Solved {
  challenges: string[]
}

@Injectable({
  providedIn: 'root'
})
export class CodeFixesService {
  private readonly hostServer = environment.hostServer
  private readonly host = this.hostServer + '/snippets/fixes'

  constructor (private readonly http: HttpClient) { }

  get (key: string): Observable<Fixes> {
    return this.http.get<Fixes>(this.host + `/${key}`).pipe(map((response: Fixes) => response), catchError((error: Error) => { throw error }))
  }

  check (key: string, selectedFix: number): Observable<result> {
    return this.http.post<result>(this.host, {
      key,
      selectedFix
    }).pipe(map((response: result) => response), catchError((error: Error) => { throw error }))
  }
}
