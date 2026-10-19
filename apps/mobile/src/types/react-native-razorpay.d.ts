/** react-native-razorpay ships no types: just the part the app uses. */
declare module 'react-native-razorpay' {
  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_signature: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
  }
  const RazorpayCheckout: {
    open(options: Record<string, unknown>): Promise<RazorpaySuccess>;
  };
  export default RazorpayCheckout;
}
