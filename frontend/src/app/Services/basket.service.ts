/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { environment } from '../../environments/environment'
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { catchError, map } from 'rxjs/operators'
import { type Observable, Subject } from 'rxjs'

interface OrderDetail {
  paymentId: string
  addressId: string
  deliveryMethodId: string
}

@Injectable({
  providedIn: 'root'
})
export class BasketService {
  public hostServer = environment.hostServer
  public itemTotal = new Subject<any>()
  private readonly host = this.hostServer + '/api/BasketItems'

  constructor (private readonly http: HttpClient) { }

  find (id?: number): Observable<{ Products: { BasketItem: { quantity: number } }[] }> {
    return this.http.get<{ Products: { BasketItem: { quantity: number } }[] }>(`${this.hostServer}/rest/basket/${id}`).pipe(map((response: { Products: { BasketItem: { quantity: number } }[] }) => response.data), catchError((error: Error) => { throw error }))
  }

  get (id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.host}/${id}`).pipe(map((response: { data: any }) => response.data), catchError((error: Error) => { throw error }))
  }

  put (id: number, params: any): Observable<{ data: any }> {
    return this.http.put<{ data: any }>(`${this.host}/${id}`, params).pipe(map((response: { data: any }) => response.data), catchError((error: Error) => { throw error }))
  }

  del (id: number): Observable<{ data: any }> {
    return this.http.delete<{ data: any }>(`${this.host}/${id}`).pipe(map((response: { data: any }) => response.data), catchError((error: Error) => { throw error }))
  }

  save (params?: any): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(this.host + '/', params).pipe(map((response: { data: any }) => response.data), catchError((error: Error) => { throw error }))
  }

  checkout (id?: number, couponData?: string, orderDetails?: OrderDetail): Observable<{ orderConfirmation: string }> {
    return this.http.post<{ orderConfirmation: string }>(`${this.hostServer}/rest/basket/${id}/checkout`, { couponData, orderDetails }).pipe(map((response: { orderConfirmation: string }) => response.orderConfirmation), catchError((error: Error) => { throw error }))
  }

  applyCoupon (id?: number, coupon?: string): Observable<{ discount: string }> {
    return this.http.put<{ discount: string }>(`${this.hostServer}/rest/basket/${id}/coupon/${coupon}`, {}).pipe(map((response: { discount: string }) => response.discount), catchError((error: Error) => { throw error }))
  }

  updateNumberOfCartItems () {
    this.find(parseInt(sessionStorage.getItem('bid'), 10)).subscribe((basket) => {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      this.itemTotal.next(basket.Products.reduce((itemTotal, product) => itemTotal + product.BasketItem.quantity, 0))
    }, (err) => { console.log(err) })
  }

  getItemTotal (): Observable<any> {
    return this.itemTotal.asObservable()
  }
}
