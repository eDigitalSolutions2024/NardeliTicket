import { Schema, model, Document } from "mongoose";

type OrderItem = {
  zoneId: string;
  tableId: string;
  seatIds: string[];
  unitPrice: number;
};

type OrderTotalsCents = {
  subtotal: number;   // centavos
  fees: number;       // centavos
  tax: number;        // centavos
  discount: number;   // centavos
  total: number;      // centavos
};

type OrderStatusV2 = "pending_payment" | "paid" | "canceled" | "expired" | "failed";

type OrderStatusTimeline = {
  status: OrderStatusV2;
  at: Date;
  note?: string;
};

type TicketItem = {
  ticketId: string;
  seatId: string;
  tableId: string;
  zoneId: string;
  qrUrl?: string;
  status: "issued" | "checked_in" | "void";
  issuedAt: Date;
  checkedInAt?: Date;
};

// 🔹 NUEVO: tipos para método de pago / efectivo
type PaymentMethod = "card" | "cash";

type CashPaymentInfo = {
  amountGiven: number;      // cuánto dio el cliente
  change: number;           // cambio entregado
  registeredAt: Date;       // cuándo se registró
  cashierUserId?: string;   // opcional: quién lo cobró
};

// encima de export interface IOrder...
type BuyerInfo = {
  name: string;
  phone?: string;
  email?: string;
};


export interface IOrder extends Document {
  currency: "MXN";
  totalsCents: OrderTotalsCents;
  userId: string;
  eventId: string;
  sessionDate?: Date;
  items: OrderItem[];

  statusTimeline?: OrderStatusTimeline[];
  paidAt?: Date;
  canceledAt?: Date;
  refundedAt?: Date;
  expiresAt?: Date;

  pricingVersion?: number;
  idempotencyKey?: string;
  tickets?: TicketItem[];
  buyer?: BuyerInfo;    

  totals: { subtotal: number; fees: number; total: number; seatCount: number };
  status: "pending" | "requires_payment" | "paid" | "canceled" | "expired" | "failed" | "pending_payment";

  // 🔹 NUEVO
  paymentMethod: PaymentMethod;
  cashPayment?: CashPaymentInfo;

  stripe?: {
    checkoutSessionId?: string;
    paymentIntentId?: string;
    chargeId?: string;
    paymentMethodBrand?: string;
    paymentMethodLast4?: string;
    receiptUrl?: string;
  };
}

const TotalsCentsSchema = new Schema<OrderTotalsCents>(
  {
    subtotal: { type: Number, default: 0 },
    fees:     { type: Number, default: 0 },
    tax:      { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total:    { type: Number, default: 0 },
  },
  { _id: false }
);

const StatusTimelineSchema = new Schema<OrderStatusTimeline>(
  {
    status: { type: String, enum: ["pending_payment","paid","canceled","expired","failed"], required: true },
    at:     { type: Date, required: true },
    note:   { type: String },
  },
  { _id: false }
);

const TicketSchema = new Schema<TicketItem>(
  {
    ticketId:    { type: String, required: true },
    seatId:      { type: String, required: true },
    tableId:     { type: String, required: true },
    zoneId:      { type: String, required: true },
    qrUrl:       { type: String },
    status:      { type: String, enum: ["issued","checked_in","void"], default: "issued" },
    issuedAt:    { type: Date, required: true },
    checkedInAt: { type: Date },
  },
  { _id: false }
);

const ItemSchema = new Schema<OrderItem>(
  {
    zoneId: String,
    tableId: String,
    seatIds: [String],
    unitPrice: Number,
  },
  { _id: false }
);

// 🔹 NUEVO: sub-schema para pago en efectivo
const CashPaymentSchema = new Schema<CashPaymentInfo>(
  {
    amountGiven:   { type: Number, required: true },
    change:        { type: Number, required: true },
    registeredAt:  { type: Date,   required: true },
    cashierUserId: { type: String },
  },
  { _id: false }
);

const BuyerSchema = new Schema<BuyerInfo>(
  {
    name:  { type: String, required: true },
    phone: { type: String },
    email: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    currency: { type: String, default: "MXN" },
    userId:   { type: String, required: true }, // del token
    eventId:  { type: String, required: true },

    totalsCents: { type: TotalsCentsSchema, default: () => ({}) },
    sessionDate: Date,
    items:       [ItemSchema],
    
    buyer: { type: BuyerSchema },  
    totals: {
      subtotal: Number,
      fees:     Number,
      total:    Number,
      seatCount: Number,
    },

    status: {
      type: String,
      enum: ["pending", "requires_payment", "paid", "canceled", "expired","failed","pending_payment"],
      default: "pending",
    },

    // 🔹 NUEVO: método de pago
    paymentMethod: {
      type: String,
      enum: ["card", "cash"],
      default: "card",
    },

    // 🔹 NUEVO: info de efectivo (solo se llena cuando es cash)
    cashPayment: { type: CashPaymentSchema },

    idempotencyKey: { type: String, index: true },
    expiresAt:      { type: Date },

    statusTimeline: { type: [StatusTimelineSchema], default: [] },

    paidAt:     { type: Date },
    canceledAt: { type: Date },
    refundedAt: { type: Date },

    pricingVersion: { type: Number },

    tickets: { type: [TicketSchema], default: [] },

    stripe: {
      checkoutSessionId: String,
      paymentIntentId:   String,
      chargeId:          String,
      paymentMethodBrand: String,
      paymentMethodLast4: String,
      receiptUrl:         String,
    },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ eventId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, expiresAt: 1 });

export default model<IOrder>("Order", OrderSchema);
