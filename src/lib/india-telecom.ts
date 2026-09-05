// ============================================
// Indian Telecom Numbering Plan & OSINT Database
// Department of Telecommunications (DoT) & TRAI Mapping
// ============================================

import { lookupCarrierByPrefix } from './carrier-database'

export interface IndianCircleInfo {
  code: string
  name: string
  category: 'Metro' | 'A' | 'B' | 'C'
  state: string
  capital: string
  latitude: number
  longitude: number
  timezone: string
}

export interface IndianPhoneInfo {
  isIndian: boolean
  circle?: IndianCircleInfo
  operator?: string
  circleName?: string
  lineType?: 'Mobile' | 'Landline' | 'Toll Free' | 'Special Service'
  series?: string
  upiHandles?: Array<{ name: string; vpa: string; app: string; deepLink: string }>
  dotPortalUrl?: string
  cybercrimePortalUrl?: string
  truecallerUrl?: string
  whatsappUrl?: string
}

// 22 Licensed Service Areas (LSA / Telecom Circles in India)
export const INDIAN_TELECOM_CIRCLES: Record<string, IndianCircleInfo> = {
  DL: { code: 'DL', name: 'Delhi NCR', category: 'Metro', state: 'Delhi', capital: 'New Delhi', latitude: 28.6139, longitude: 77.2090, timezone: 'Asia/Kolkata' },
  MUM: { code: 'MUM', name: 'Mumbai', category: 'Metro', state: 'Maharashtra', capital: 'Mumbai', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata' },
  KOL: { code: 'KOL', name: 'Kolkata', category: 'Metro', state: 'West Bengal', capital: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata' },
  MH: { code: 'MH', name: 'Maharashtra & Goa', category: 'A', state: 'Maharashtra', capital: 'Pune', latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata' },
  GJ: { code: 'GJ', name: 'Gujarat & Daman/Diu', category: 'A', state: 'Gujarat', capital: 'Gandhinagar', latitude: 23.2156, longitude: 72.6369, timezone: 'Asia/Kolkata' },
  AP: { code: 'AP', name: 'Andhra Pradesh & Telangana', category: 'A', state: 'Telangana', capital: 'Hyderabad', latitude: 17.3850, longitude: 78.4867, timezone: 'Asia/Kolkata' },
  KA: { code: 'KA', name: 'Karnataka', category: 'A', state: 'Karnataka', capital: 'Bengaluru', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
  TN: { code: 'TN', name: 'Tamil Nadu & Chennai', category: 'A', state: 'Tamil Nadu', capital: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' },
  KL: { code: 'KL', name: 'Kerala & Lakshadweep', category: 'B', state: 'Kerala', capital: 'Thiruvananthapuram', latitude: 8.5241, longitude: 76.9366, timezone: 'Asia/Kolkata' },
  PB: { code: 'PB', name: 'Punjab & Chandigarh', category: 'B', state: 'Punjab', capital: 'Chandigarh', latitude: 30.7333, longitude: 76.7794, timezone: 'Asia/Kolkata' },
  HR: { code: 'HR', name: 'Haryana', category: 'B', state: 'Haryana', capital: 'Panchkula', latitude: 30.6942, longitude: 76.8606, timezone: 'Asia/Kolkata' },
  UPE: { code: 'UPE', name: 'Uttar Pradesh (East)', category: 'B', state: 'Uttar Pradesh', capital: 'Lucknow', latitude: 26.8467, longitude: 80.9462, timezone: 'Asia/Kolkata' },
  UPW: { code: 'UPW', name: 'Uttar Pradesh (West) & Uttarakhand', category: 'B', state: 'Uttar Pradesh', capital: 'Meerut', latitude: 28.9845, longitude: 77.7064, timezone: 'Asia/Kolkata' },
  RJ: { code: 'RJ', name: 'Rajasthan', category: 'B', state: 'Rajasthan', capital: 'Jaipur', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata' },
  MP: { code: 'MP', name: 'Madhya Pradesh & Chhattisgarh', category: 'B', state: 'Madhya Pradesh', capital: 'Bhopal', latitude: 23.2599, longitude: 77.4126, timezone: 'Asia/Kolkata' },
  WB: { code: 'WB', name: 'West Bengal & Sikkim', category: 'B', state: 'West Bengal', capital: 'Siliguri', latitude: 26.7271, longitude: 88.3953, timezone: 'Asia/Kolkata' },
  OR: { code: 'OR', name: 'Odisha', category: 'C', state: 'Odisha', capital: 'Bhubaneswar', latitude: 20.2961, longitude: 85.8245, timezone: 'Asia/Kolkata' },
  BR: { code: 'BR', name: 'Bihar & Jharkhand', category: 'C', state: 'Bihar', capital: 'Patna', latitude: 25.5941, longitude: 85.1376, timezone: 'Asia/Kolkata' },
  AS: { code: 'AS', name: 'Assam', category: 'C', state: 'Assam', capital: 'Guwahati', latitude: 26.1445, longitude: 91.7362, timezone: 'Asia/Kolkata' },
  NE: { code: 'NE', name: 'North East (Arunachal, Meghalaya, Manipur, Mizoram, Nagaland, Tripura)', category: 'C', state: 'Meghalaya', capital: 'Shillong', latitude: 25.5788, longitude: 91.8933, timezone: 'Asia/Kolkata' },
  JK: { code: 'JK', name: 'Jammu & Kashmir & Ladakh', category: 'C', state: 'Jammu & Kashmir', capital: 'Srinagar', latitude: 34.0837, longitude: 74.7973, timezone: 'Asia/Kolkata' },
  HP: { code: 'HP', name: 'Himachal Pradesh', category: 'C', state: 'Himachal Pradesh', capital: 'Shimla', latitude: 31.1048, longitude: 77.1734, timezone: 'Asia/Kolkata' },
}

// Major 4-digit Series mapping to initial Circle & Operator allocated by DoT
const PREFIX_ALLOCATIONS: Array<{ prefix: string; operator: string; circleCode: string }> = [
  // Jio (6xxx, 70xx, 79xx, 89xx, etc.)
  { prefix: '6000', operator: 'Reliance Jio', circleCode: 'AS' },
  { prefix: '6001', operator: 'Reliance Jio', circleCode: 'NE' },
  { prefix: '6002', operator: 'Reliance Jio', circleCode: 'AS' },
  { prefix: '6003', operator: 'Reliance Jio', circleCode: 'AS' },
  { prefix: '6004', operator: 'Reliance Jio', circleCode: 'NE' },
  { prefix: '6005', operator: 'Reliance Jio', circleCode: 'JK' },
  { prefix: '6006', operator: 'Reliance Jio', circleCode: 'JK' },
  { prefix: '6007', operator: 'Reliance Jio', circleCode: 'JK' },
  { prefix: '6200', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6201', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6202', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6203', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6204', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6205', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6206', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6207', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6208', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6209', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '6239', operator: 'Reliance Jio', circleCode: 'PB' },
  { prefix: '6260', operator: 'Reliance Jio', circleCode: 'MP' },
  { prefix: '6261', operator: 'Reliance Jio', circleCode: 'MP' },
  { prefix: '6262', operator: 'Reliance Jio', circleCode: 'MP' },
  { prefix: '6280', operator: 'Reliance Jio', circleCode: 'PB' },
  { prefix: '6281', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6282', operator: 'Reliance Jio', circleCode: 'KL' },
  { prefix: '6283', operator: 'Reliance Jio', circleCode: 'PB' },
  { prefix: '6284', operator: 'Reliance Jio', circleCode: 'PB' },
  { prefix: '6289', operator: 'Reliance Jio', circleCode: 'KOL' },
  { prefix: '6290', operator: 'Reliance Jio', circleCode: 'KOL' },
  { prefix: '6291', operator: 'Reliance Jio', circleCode: 'KOL' },
  { prefix: '6292', operator: 'Reliance Jio', circleCode: 'KOL' },
  { prefix: '6294', operator: 'Reliance Jio', circleCode: 'WB' },
  { prefix: '6295', operator: 'Reliance Jio', circleCode: 'WB' },
  { prefix: '6296', operator: 'Reliance Jio', circleCode: 'WB' },
  { prefix: '6297', operator: 'Reliance Jio', circleCode: 'WB' },
  { prefix: '6300', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6301', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6302', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6303', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6304', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6305', operator: 'Reliance Jio', circleCode: 'AP' },
  { prefix: '6350', operator: 'Reliance Jio', circleCode: 'RJ' },
  { prefix: '6351', operator: 'Reliance Jio', circleCode: 'GJ' },
  { prefix: '6352', operator: 'Reliance Jio', circleCode: 'GJ' },
  { prefix: '6353', operator: 'Reliance Jio', circleCode: 'GJ' },
  { prefix: '6354', operator: 'Reliance Jio', circleCode: 'GJ' },
  { prefix: '6355', operator: 'Reliance Jio', circleCode: 'GJ' },
  { prefix: '6360', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6361', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6362', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6363', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6364', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6366', operator: 'Reliance Jio', circleCode: 'KA' },
  { prefix: '6370', operator: 'Reliance Jio', circleCode: 'OR' },
  { prefix: '6371', operator: 'Reliance Jio', circleCode: 'OR' },
  { prefix: '6372', operator: 'Reliance Jio', circleCode: 'OR' },
  { prefix: '6375', operator: 'Reliance Jio', circleCode: 'RJ' },
  { prefix: '6376', operator: 'Reliance Jio', circleCode: 'RJ' },
  { prefix: '6377', operator: 'Reliance Jio', circleCode: 'RJ' },
  { prefix: '6378', operator: 'Reliance Jio', circleCode: 'RJ' },
  { prefix: '6379', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6380', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6381', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6382', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6383', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6384', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6385', operator: 'Reliance Jio', circleCode: 'TN' },
  { prefix: '6386', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6387', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6388', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6389', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6390', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6391', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6392', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6393', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6394', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '6395', operator: 'Reliance Jio', circleCode: 'UPW' },
  { prefix: '6396', operator: 'Reliance Jio', circleCode: 'UPW' },
  { prefix: '6397', operator: 'Reliance Jio', circleCode: 'UPW' },
  { prefix: '6398', operator: 'Reliance Jio', circleCode: 'UPW' },

  // Bharti Airtel (9810, 9811, 9845, 9840, 9890, etc.)
  { prefix: '9810', operator: 'Bharti Airtel', circleCode: 'DL' },
  { prefix: '9811', operator: 'Vodafone Idea (Vi)', circleCode: 'DL' },
  { prefix: '9812', operator: 'Vodafone Idea (Vi)', circleCode: 'HR' },
  { prefix: '9813', operator: 'Vodafone Idea (Vi)', circleCode: 'HR' },
  { prefix: '9814', operator: 'Vodafone Idea (Vi)', circleCode: 'PB' },
  { prefix: '9815', operator: 'Bharti Airtel', circleCode: 'PB' },
  { prefix: '9816', operator: 'Bharti Airtel', circleCode: 'HP' },
  { prefix: '9817', operator: 'Reliance Communications', circleCode: 'HP' },
  { prefix: '9818', operator: 'Bharti Airtel', circleCode: 'DL' },
  { prefix: '9819', operator: 'Vodafone Idea (Vi)', circleCode: 'MUM' },
  { prefix: '9820', operator: 'Vodafone Idea (Vi)', circleCode: 'MUM' },
  { prefix: '9821', operator: 'Vodafone Idea (Vi)', circleCode: 'MUM' },
  { prefix: '9822', operator: 'Vodafone Idea (Vi)', circleCode: 'MH' },
  { prefix: '9823', operator: 'Vodafone Idea (Vi)', circleCode: 'MH' },
  { prefix: '9824', operator: 'Vodafone Idea (Vi)', circleCode: 'GJ' },
  { prefix: '9825', operator: 'Vodafone Idea (Vi)', circleCode: 'GJ' },
  { prefix: '9826', operator: 'Vodafone Idea (Vi)', circleCode: 'MP' },
  { prefix: '9827', operator: 'Reliance Communications', circleCode: 'MP' },
  { prefix: '9828', operator: 'Vodafone Idea (Vi)', circleCode: 'RJ' },
  { prefix: '9829', operator: 'Bharti Airtel', circleCode: 'RJ' },
  { prefix: '9830', operator: 'Vodafone Idea (Vi)', circleCode: 'KOL' },
  { prefix: '9831', operator: 'Bharti Airtel', circleCode: 'KOL' },
  { prefix: '9832', operator: 'Reliance Communications', circleCode: 'WB' },
  { prefix: '9833', operator: 'Vodafone Idea (Vi)', circleCode: 'MUM' },
  { prefix: '9835', operator: 'Reliance Communications', circleCode: 'BR' },
  { prefix: '9836', operator: 'Vodafone Idea (Vi)', circleCode: 'KOL' },
  { prefix: '9837', operator: 'Vodafone Idea (Vi)', circleCode: 'UPW' },
  { prefix: '9838', operator: 'Vodafone Idea (Vi)', circleCode: 'UPE' },
  { prefix: '9839', operator: 'Vodafone Idea (Vi)', circleCode: 'UPE' },
  { prefix: '9840', operator: 'Bharti Airtel', circleCode: 'TN' },
  { prefix: '9841', operator: 'Bharti Airtel', circleCode: 'TN' },
  { prefix: '9842', operator: 'Bharti Airtel', circleCode: 'TN' },
  { prefix: '9843', operator: 'Vodafone Idea (Vi)', circleCode: 'TN' },
  { prefix: '9844', operator: 'Vodafone Idea (Vi)', circleCode: 'KA' },
  { prefix: '9845', operator: 'Bharti Airtel', circleCode: 'KA' },
  { prefix: '9846', operator: 'Vodafone Idea (Vi)', circleCode: 'KL' },
  { prefix: '9847', operator: 'Vodafone Idea (Vi)', circleCode: 'KL' },
  { prefix: '9848', operator: 'Vodafone Idea (Vi)', circleCode: 'AP' },
  { prefix: '9849', operator: 'Bharti Airtel', circleCode: 'AP' },
  { prefix: '9850', operator: 'Vodafone Idea (Vi)', circleCode: 'MH' },
  { prefix: '9860', operator: 'Bharti Airtel', circleCode: 'MH' },
  { prefix: '9866', operator: 'Bharti Airtel', circleCode: 'AP' },
  { prefix: '9871', operator: 'Bharti Airtel', circleCode: 'DL' },
  { prefix: '9872', operator: 'Bharti Airtel', circleCode: 'PB' },
  { prefix: '9873', operator: 'Vodafone Idea (Vi)', circleCode: 'DL' },
  { prefix: '9876', operator: 'Bharti Airtel', circleCode: 'PB' },
  { prefix: '9880', operator: 'Bharti Airtel', circleCode: 'KA' },
  { prefix: '9886', operator: 'Vodafone Idea (Vi)', circleCode: 'KA' },
  { prefix: '9890', operator: 'Bharti Airtel', circleCode: 'MH' },
  { prefix: '9891', operator: 'Vodafone Idea (Vi)', circleCode: 'DL' },
  { prefix: '9892', operator: 'Bharti Airtel', circleCode: 'MUM' },
  { prefix: '9893', operator: 'Bharti Airtel', circleCode: 'MP' },
  { prefix: '9894', operator: 'Bharti Airtel', circleCode: 'TN' },
  { prefix: '9895', operator: 'Bharti Airtel', circleCode: 'KL' },
  { prefix: '9896', operator: 'Bharti Airtel', circleCode: 'HR' },
  { prefix: '9897', operator: 'Bharti Airtel', circleCode: 'UPW' },
  { prefix: '9898', operator: 'Bharti Airtel', circleCode: 'GJ' },
  { prefix: '9899', operator: 'Vodafone Idea (Vi)', circleCode: 'DL' },

  // BSNL / MTNL
  { prefix: '9412', operator: 'BSNL Mobile', circleCode: 'UPW' },
  { prefix: '9414', operator: 'BSNL Mobile', circleCode: 'RJ' },
  { prefix: '9415', operator: 'BSNL Mobile', circleCode: 'UPE' },
  { prefix: '9416', operator: 'BSNL Mobile', circleCode: 'HR' },
  { prefix: '9417', operator: 'BSNL Mobile', circleCode: 'PB' },
  { prefix: '9418', operator: 'BSNL Mobile', circleCode: 'HP' },
  { prefix: '9419', operator: 'BSNL Mobile', circleCode: 'JK' },
  { prefix: '9420', operator: 'BSNL Mobile', circleCode: 'MH' },
  { prefix: '9421', operator: 'BSNL Mobile', circleCode: 'MH' },
  { prefix: '9422', operator: 'BSNL Mobile', circleCode: 'MH' },
  { prefix: '9423', operator: 'BSNL Mobile', circleCode: 'MH' },
  { prefix: '9424', operator: 'BSNL Mobile', circleCode: 'MP' },
  { prefix: '9425', operator: 'BSNL Mobile', circleCode: 'MP' },
  { prefix: '9426', operator: 'BSNL Mobile', circleCode: 'GJ' },
  { prefix: '9427', operator: 'BSNL Mobile', circleCode: 'GJ' },
  { prefix: '9428', operator: 'BSNL Mobile', circleCode: 'GJ' },
  { prefix: '9430', operator: 'BSNL Mobile', circleCode: 'BR' },
  { prefix: '9431', operator: 'BSNL Mobile', circleCode: 'BR' },
  { prefix: '9432', operator: 'BSNL Mobile', circleCode: 'KOL' },
  { prefix: '9433', operator: 'BSNL Mobile', circleCode: 'KOL' },
  { prefix: '9434', operator: 'BSNL Mobile', circleCode: 'WB' },
  { prefix: '9435', operator: 'BSNL Mobile', circleCode: 'AS' },
  { prefix: '9436', operator: 'BSNL Mobile', circleCode: 'NE' },
  { prefix: '9437', operator: 'BSNL Mobile', circleCode: 'OR' },
  { prefix: '9438', operator: 'BSNL Mobile', circleCode: 'OR' },
  { prefix: '9439', operator: 'BSNL Mobile', circleCode: 'OR' },
  { prefix: '9440', operator: 'BSNL Mobile', circleCode: 'AP' },
  { prefix: '9441', operator: 'BSNL Mobile', circleCode: 'AP' },
  { prefix: '9442', operator: 'BSNL Mobile', circleCode: 'TN' },
  { prefix: '9443', operator: 'BSNL Mobile', circleCode: 'TN' },
  { prefix: '9444', operator: 'BSNL Mobile', circleCode: 'TN' },
  { prefix: '9446', operator: 'BSNL Mobile', circleCode: 'KL' },
  { prefix: '9447', operator: 'BSNL Mobile', circleCode: 'KL' },
  { prefix: '9448', operator: 'BSNL Mobile', circleCode: 'KA' },
  { prefix: '9449', operator: 'BSNL Mobile', circleCode: 'KA' },
  { prefix: '9480', operator: 'BSNL Mobile', circleCode: 'KA' },
  { prefix: '9481', operator: 'BSNL Mobile', circleCode: 'KA' },
  { prefix: '9482', operator: 'BSNL Mobile', circleCode: 'KA' },
  // MTS / Sistema Shyam (Ported / Acquired)
  { prefix: '8453', operator: 'MTS India (Ported / Active)', circleCode: 'KA' },
  // Reliance Jio 7000 Series
  { prefix: '7000', operator: 'Reliance Jio', circleCode: 'MP' },
  { prefix: '7001', operator: 'Reliance Jio', circleCode: 'WB' },
  { prefix: '7002', operator: 'Reliance Jio', circleCode: 'AS' },
  { prefix: '7003', operator: 'Reliance Jio', circleCode: 'KOL' },
  { prefix: '7004', operator: 'Reliance Jio', circleCode: 'BR' },
  { prefix: '7005', operator: 'Reliance Jio', circleCode: 'NE' },
  { prefix: '7006', operator: 'Reliance Jio', circleCode: 'JK' },
  { prefix: '7007', operator: 'Reliance Jio', circleCode: 'UPE' },
  { prefix: '7008', operator: 'Reliance Jio', circleCode: 'OR' },
  { prefix: '7009', operator: 'Reliance Jio', circleCode: 'PB' },
]

export function parseIndianPhoneNumber(phone: string): IndianPhoneInfo {
  const cleaned = phone.replace(/[^\d]/g, '')
  
  // Check if Indian (starts with 91 and has 12 digits, or starts with 0 and has 11, or 10 digits)
  let raw10 = ''
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    raw10 = cleaned.slice(2)
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    raw10 = cleaned.slice(1)
  } else if (cleaned.length === 10) {
    raw10 = cleaned
  } else {
    return { isIndian: false }
  }

  const firstDigit = raw10.charAt(0)
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return {
      isIndian: true,
      lineType: raw10.startsWith('1800') ? 'Toll Free' : 'Landline',
    }
  }

  const prefix4 = raw10.slice(0, 4)
  const allocation = PREFIX_ALLOCATIONS.find((a) => a.prefix === prefix4)

  let circle: IndianCircleInfo | undefined
  let operator = allocation?.operator

  if (!operator) {
    const carrierMatch = lookupCarrierByPrefix('91' + raw10)
    if (carrierMatch) {
      operator = carrierMatch.normalizedName
    } else {
      operator = 'Indian Cellular Network (GSM/LTE/5G)'
    }
  }

  if (allocation?.circleCode && INDIAN_TELECOM_CIRCLES[allocation.circleCode]) {
    circle = INDIAN_TELECOM_CIRCLES[allocation.circleCode]
  }

  // Generate UPI IDs commonly linked to 10-digit mobile numbers
  const upiHandles = [
    { name: 'PhonePe', vpa: `${raw10}@ybl`, app: 'PhonePe', deepLink: `upi://pay?pa=${raw10}@ybl&pn=User` },
    { name: 'Paytm', vpa: `${raw10}@paytm`, app: 'Paytm', deepLink: `upi://pay?pa=${raw10}@paytm&pn=User` },
    { name: 'Google Pay (GPay)', vpa: `${raw10}@okaxis`, app: 'Google Pay', deepLink: `upi://pay?pa=${raw10}@okaxis&pn=User` },
    { name: 'BHIM / NPCI', vpa: `${raw10}@upi`, app: 'BHIM', deepLink: `upi://pay?pa=${raw10}@upi&pn=User` },
    { name: 'Amazon Pay', vpa: `${raw10}@apl`, app: 'Amazon Pay', deepLink: `upi://pay?pa=${raw10}@apl&pn=User` },
  ]

  return {
    isIndian: true,
    circle,
    operator,
    circleName: circle?.name || 'India Mobile Circle',
    lineType: 'Mobile',
    series: prefix4,
    upiHandles,
    truecallerUrl: `https://www.truecaller.com/search/in/+91${raw10}`,
    whatsappUrl: `https://wa.me/91${raw10}`,
    dotPortalUrl: 'https://sancharsaathi.gov.in/sfc/',
    cybercrimePortalUrl: 'https://cybercrime.gov.in/',
  }
}
