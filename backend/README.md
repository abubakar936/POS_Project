<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Orders and invoices

All order and invoice endpoints require the existing JWT authorization.

- `POST /orders` creates an order with one or more product/stock lines. Each line
  requires `productId` and a positive `quantity`; regular lines also require
  `stockId` and use the selected stock record's sale price. A line may instead
  set `soldUnavailable: true` and omit `stockId` only when the product has no
  remaining stock. These lines are recorded on the order and do not change stock.
  Optional customer details can be provided with `customerId` or as
  `customerName`, `customerPhone`, and `customerAddress`.
  Line discounts and the order-level `discountAmount` are amounts in the same
  currency as stock prices; the total is calculated by the API.
- `GET /orders?page=1&limit=10&search=` lists orders; `GET /orders/:id` reads
  one. `PATCH /orders/:id` updates customer details, note, discounts, or replaces
  the lines. `DELETE /orders/:id` soft-deletes an order.
- Creating, replacing, or deleting order lines adjusts stock in the same
  database transaction. Orders cannot be edited or deleted after an invoice has
  been created for them.
- Orders expose a sequential `saleNumber`; invoices expose a sequential
  `invoiceNumber`, generated during finalization. Database UUIDs remain
  relationship keys and are not display numbers.
- `POST /invoices` creates an invoice from `{ "orderId": "<ORDER_ID>" }`.
  Invoice items, customer details, and totals are immutable snapshots of the
  order. `GET /invoices`, `GET /invoices/:id`, `PATCH /invoices/:id`, and
  `DELETE /invoices/:id` provide invoice CRUD; updates are limited to the note
  and due date.
- `POST /invoices/:id/payments` records `{ "amount": "50.00",
  "paymentMethod": "CASH", "paymentDate": "2026-11-04" }` as a new installment.
  `GET /invoices/:id/payments` lists active payments, `PATCH
  /invoices/:id/payments/:paymentId` edits one installment, and
  `DELETE /invoices/:id/payments/:paymentId` removes a payment.
  Payments cannot exceed the invoice balance; invoice responses include
  `amountPaid`, `balanceDue`, and `status`. An invoice with active payments must
  have those payments removed before it can be deleted.

## Dashboard

`GET /dashboard` requires JWT authorization and accepts `from` and `to` ISO
timestamps, an optional `bucket` (`hour`, `day`, `week`, or `month`), and an
optional IANA `timeZone`. The `to` timestamp is exclusive and ranges are limited
to 366 days. Sales, payment receipts, customer counts, receivables, product
rankings, trends, and recent sales are aggregated in PostgreSQL. Low-stock
quantities reflect current inventory. Lifetime sales are intentionally not
limited by the selected range.

Order-item purchase prices are snapshotted at sale time. Profit is returned as
`null` when the selected period includes a sale item without a known purchase
cost; `unknownCostItems` indicates the missing coverage instead of treating
unknown cost as zero.

Apply pending TypeORM migrations before starting the updated application on an
existing database. `1792700000000-AddSaleNumbersAndUnavailableItems` backfills
readable sale and invoice numbers and adds unavailable-item tracking.
`1792800000000-AddOrderItemPurchasePriceSnapshot` backfills available purchase
costs and adds indexes used by dashboard aggregates.
`1792900000000-AddInvoicePaymentDate` backfills each historical installment date
from its creation timestamp and adds the invoice-payment lookup index.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
