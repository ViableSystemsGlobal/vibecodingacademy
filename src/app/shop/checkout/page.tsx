"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Truck, User, CheckCircle, Package, MapPin } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";
import { useBranding } from "@/contexts/branding-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { cn } from "@/lib/utils";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  lineTotal: number;
  image: string | null;
  sku?: string | null;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

const ADDRESS_STORAGE_KEY = "poolshop-checkout-addresses";

type AddressType = "SHIPPING" | "BILLING";

interface SavedAddress {
  id: string;
  backendId?: string;
  type: AddressType | "BOTH";
  street: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
  label?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isDefault?: boolean;
  source: "local" | "account";
  createdAt: number;
}

function normalise(value: string | undefined | null) {
  return (value ?? "").trim();
}

function createAddressId(address: {
  street: string;
  city: string;
  region: string;
  postalCode?: string;
  country?: string;
}, type: AddressType) {
  const parts = [
    normalise(address.street).toLowerCase(),
    normalise(address.city).toLowerCase(),
    normalise(address.region).toLowerCase(),
    normalise(address.postalCode).toLowerCase(),
    normalise(address.country ?? "Ghana").toLowerCase(),
  ];
  return `${type}:${parts.join("|")}`;
}

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) {
    return hex;
  }
  const num = parseInt(cleaned, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "Ghana",
  });

  const [billingAddress, setBillingAddress] = useState({
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "Ghana",
  });

  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<string[]>([]);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { success, error: showError } = useToast();
  const { getThemeColor } = useBranding();
  const themeColor = getThemeColor();
  const { customer, loading: authLoading } = useCustomerAuth();
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState<string | null>(null);
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState<string | null>(null);
  const hasTrackedCheckout = useRef(false);

  useEffect(() => {
    fetchCart();
    fetchEcommerceSettings();
  }, []);

  const fetchEcommerceSettings = async () => {
    try {
      const response = await fetch('/api/ecommerce/settings');
      if (response.ok) {
        const data = await response.json();
        const methods = (data.paymentMethods || "ONLINE,CASH,BANK_TRANSFER,MOBILE_MONEY")
          .split(',')
          .map((m: string) => m.trim())
          .filter(Boolean);
        setAvailablePaymentMethods(methods);
        // Set default payment method to first available
        if (methods.length > 0 && !methods.includes(paymentMethod)) {
          setPaymentMethod(methods[0]);
        }
        
        // Check customer settings and redirect if needed
        if (!authLoading) {
          const requireAccountCreation = data.requireAccountCreation === true;
          const allowGuestCheckout = data.allowGuestCheckout !== false; // Default to true if not set
          const requireEmailVerification = data.requireEmailVerification === true;
          
          // If account creation is required and user is not logged in, redirect
          if (requireAccountCreation && !customer) {
            showError("Account Required", "Please create an account or log in to checkout");
            setTimeout(() => {
              router.push("/shop/auth/login?redirect=/shop/checkout");
            }, 2000);
            return;
          }
          
          // If guest checkout is not allowed and user is not logged in, redirect
          if (!allowGuestCheckout && !customer) {
            showError("Account Required", "Guest checkout is not available. Please create an account or log in.");
            setTimeout(() => {
              router.push("/shop/auth/login?redirect=/shop/checkout");
            }, 2000);
            return;
          }
          
          // If email verification is required and user is logged in but not verified
          if (requireEmailVerification && customer && customer.emailVerified === false) {
            showError("Email Verification Required", "Please verify your email address before checkout");
            setTimeout(() => {
              router.push("/shop/account");
            }, 2000);
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching ecommerce settings:", error);
      // Fallback to default methods
      setAvailablePaymentMethods(["ONLINE", "CASH", "BANK_TRANSFER", "MOBILE_MONEY"]);
    }
  };

  useEffect(() => {
    if (!customer) {
      setSavedAddresses((prev) => prev.filter((address) => address.source === "local"));
    }
  }, [customer]);

  useEffect(() => {
    if (!customer) {
      return;
    }

    let ignore = false;

    const loadAccountAddresses = async () => {
      try {
        const response = await fetch("/api/public/shop/addresses", {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const incoming: SavedAddress[] = Array.isArray(data?.addresses)
          ? data.addresses
              .map(mapAccountAddressRecord)
              .filter((address: SavedAddress | null): address is SavedAddress => address !== null)
          : [];

        if (ignore || incoming.length === 0) {
          return;
        }

        setSavedAddresses((prev) => {
          const incomingMap = new Map(incoming.map((address) => [address.id, address]));
          const filteredPrev = prev.filter((address) => !incomingMap.has(address.id));
          const combined = [...filteredPrev, ...incoming].sort((a, b) => b.createdAt - a.createdAt);
          return combined;
        });

        const defaultAddress =
          incoming.find((address) => address.isDefault) ?? incoming[0];

        if (defaultAddress) {
          // Populate customer information from default address
          if (defaultAddress.firstName || defaultAddress.lastName || defaultAddress.phone) {
            const fullName = [defaultAddress.firstName, defaultAddress.lastName]
              .filter(Boolean)
              .join(" ")
              .trim();
            
            setCustomerInfo((prev) => ({
              name: prev.name || fullName,
              email: prev.email || customer?.email || "",
              phone: prev.phone || defaultAddress.phone || customer?.phone || "",
              company: prev.company || "",
            }));
          }

          setShippingAddress((prev) => {
            if (prev.street) {
              return prev;
            }
            return {
              street: defaultAddress.street,
              city: defaultAddress.city,
              region: defaultAddress.region,
              postalCode: defaultAddress.postalCode ?? "",
              country: defaultAddress.country,
            };
          });
          setSelectedShippingAddressId((prev) => prev ?? defaultAddress.id);
          if (sameAsShipping) {
            setBillingAddress((prev) => {
              if (prev.street) {
                return prev;
              }
              return {
                street: defaultAddress.street,
                city: defaultAddress.city,
                region: defaultAddress.region,
                postalCode: defaultAddress.postalCode ?? "",
                country: defaultAddress.country,
              };
            });
            setSelectedBillingAddressId((prev) => prev ?? defaultAddress.id);
          }
        }
      } catch (error) {
        console.error("Failed to load account addresses:", error);
      }
    };

    void loadAccountAddresses();

    return () => {
      ignore = true;
    };
  }, [customer, sameAsShipping]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(ADDRESS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Partial<SavedAddress>>;
        const mapped: SavedAddress[] = parsed
          .map((entry): SavedAddress | null => {
            const type: AddressType = entry?.type === "BILLING" ? "BILLING" : "SHIPPING";
            const street = normalise(entry?.street);
            const city = normalise(entry?.city);
            const region = normalise(entry?.region);
            if (!street || !city || !region) {
              return null;
            }
            const id =
              typeof entry?.id === "string" && entry.id.length > 0
                ? entry.id
                : createAddressId(
                    {
                      street,
                      city,
                      region,
                      postalCode: entry?.postalCode ?? "",
                      country: entry?.country ?? "Ghana",
                    },
                    type
                  );
            return {
              id,
              backendId: undefined,
              type,
              street,
              city,
              region,
              postalCode: normalise(entry?.postalCode),
              country: normalise(entry?.country ?? "Ghana") || "Ghana",
              label: entry?.label,
              phone: entry?.phone,
              firstName: entry?.firstName,
              lastName: entry?.lastName,
              isDefault: entry?.isDefault,
              source: "local" as const,
              createdAt:
                typeof entry?.createdAt === "number"
                  ? entry.createdAt
                  : new Date().getTime(),
            };
          })
          .filter((address): address is SavedAddress => address !== null);
        setSavedAddresses(mapped);
      }
    } catch (error) {
      console.warn("Failed to load saved checkout addresses:", error);
    }
  }, []);

  const shippingAddressOptions = useMemo(
    () =>
      savedAddresses
        .filter((address) => address.type === "SHIPPING" || address.type === "BOTH")
        .map((address) =>
          address.type === "BOTH"
            ? { ...address, type: "SHIPPING" as AddressType }
            : address
        ),
    [savedAddresses]
  );
  const billingAddressOptions = useMemo(
    () =>
      savedAddresses
        .filter((address) => address.type === "BILLING" || address.type === "BOTH")
        .map((address) =>
          address.type === "BOTH"
            ? { ...address, type: "BILLING" as AddressType }
            : address
        ),
    [savedAddresses]
  );
  const accountAddresses = useMemo(
    () => savedAddresses.filter((address) => address.source === "account"),
    [savedAddresses]
  );

  const mapAccountAddressRecord = (address: any): SavedAddress | null => {
    const street = normalise(address?.street);
    const city = normalise(address?.city);
    const region = normalise(address?.region);
    if (!street || !city || !region) {
      return null;
    }
    return {
      id: `account-${address.id}`,
      backendId: address.id,
      type: "BOTH",
      street,
      city,
      region,
      postalCode: normalise(address?.postalCode),
      country: normalise(address?.country ?? "Ghana") || "Ghana",
      label: address?.label ?? undefined,
      phone: address?.phone ?? undefined,
      firstName: address?.firstName ?? undefined,
      lastName: address?.lastName ?? undefined,
      isDefault: Boolean(address?.isDefault),
      source: "account",
      createdAt: address?.createdAt ? new Date(address.createdAt).getTime() : Date.now(),
    };
  };

  const addressesMatch = (saved: SavedAddress, address: typeof shippingAddress) => {
    return (
      normalise(saved.street) === normalise(address.street) &&
      normalise(saved.city) === normalise(address.city) &&
      normalise(saved.region) === normalise(address.region) &&
      normalise(saved.postalCode) === normalise(address.postalCode) &&
      normalise(saved.country) === normalise(address.country || "Ghana")
    );
  };

  const addressesAreSame = (
    first: typeof shippingAddress,
    second: typeof shippingAddress
  ) => {
    return (
      normalise(first.street) === normalise(second.street) &&
      normalise(first.city) === normalise(second.city) &&
      normalise(first.region) === normalise(second.region) &&
      normalise(first.postalCode) === normalise(second.postalCode) &&
      normalise(first.country || "Ghana") === normalise(second.country || "Ghana")
    );
  };

  const deriveNameParts = () => {
    const fallbackFirst = customer?.firstName || "Valued";
    const fallbackLast = customer?.lastName || "Customer";
    const fullName = normalise(customerInfo.name);
    if (!fullName) {
      return { firstName: fallbackFirst, lastName: fallbackLast };
    }
    const parts = fullName.split(/\s+/);
    const firstName = parts[0] || fallbackFirst;
    const lastName = parts.slice(1).join(" ") || fallbackLast;
    return { firstName, lastName };
  };

  const saveAddressToAccount = async (address: typeof shippingAddress, type: AddressType) => {
    if (!customer) {
      return null;
    }

    const street = normalise(address.street);
    const city = normalise(address.city);
    const region = normalise(address.region);
    if (!street || !city || !region) {
      return null;
    }

    const existing = accountAddresses.find((entry) => addressesMatch(entry, address));
    if (existing) {
      return existing;
    }

    try {
      const { firstName, lastName } = deriveNameParts();
      const response = await fetch("/api/public/shop/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          label: type === "SHIPPING" ? "Shipping Address" : "Billing Address",
          firstName,
          lastName,
          phone: customerInfo.phone || customer.phone || undefined,
          street,
          city,
          region,
          postalCode: normalise(address.postalCode),
          country: normalise(address.country || "Ghana") || "Ghana",
          isDefault: type === "SHIPPING" && accountAddresses.length === 0,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.address) {
        throw new Error(data?.error || "Failed to save address");
      }

      const mapped = mapAccountAddressRecord(data.address);
      if (mapped) {
        setSavedAddresses((prev) => {
          const filteredPrev = prev.filter((entry) => entry.id !== mapped.id);
          return [...filteredPrev, mapped].sort((a, b) => b.createdAt - a.createdAt);
        });
      }

      return mapped;
    } catch (error) {
      console.error("Failed to save account address:", error);
      return null;
    }
  };

  const saveAddressesToStorage = (addresses: SavedAddress[]) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const locals = addresses
        .filter((address) => address.source === "local")
        .map(({ source: _source, backendId: _backendId, ...rest }) => rest);
      window.localStorage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(locals));
    } catch (error) {
      console.warn("Failed to store checkout addresses:", error);
    }
  };

  const upsertSavedAddress = (
    address: typeof shippingAddress,
    type: AddressType
  ) => {
    const street = normalise(address.street);
    const city = normalise(address.city);
    const region = normalise(address.region);
    if (!street || !city || !region) {
      return;
    }

    const postalCode = normalise(address.postalCode);
    const country = normalise(address.country || "Ghana") || "Ghana";
    const id = createAddressId(
      {
        street,
        city,
        region,
        postalCode,
        country,
      },
      type
    );

    setSavedAddresses((prev) => {
      const existing = prev.find((entry) => entry.id === id);
    const record: SavedAddress = {
      id,
        backendId: existing?.backendId,
      type,
        street,
        city,
        region,
        postalCode,
        country,
        label: existing?.label,
        phone: existing?.phone,
        firstName: existing?.firstName,
        lastName: existing?.lastName,
        isDefault: existing?.isDefault,
        source: "local",
        createdAt: existing?.createdAt ?? Date.now(),
    };

      const updated = existing
        ? prev.map((entry) => (entry.id === id ? record : entry))
        : [record, ...prev].slice(0, 10);

      saveAddressesToStorage(updated);
      return updated;
    });
  };

  const persistCurrentAddresses = async () => {
    upsertSavedAddress(shippingAddress, "SHIPPING");
    if (!sameAsShipping) {
      upsertSavedAddress(billingAddress, "BILLING");
    }
    if (customer) {
      await saveAddressToAccount(shippingAddress, "SHIPPING");
      if (!sameAsShipping && !addressesAreSame(shippingAddress, billingAddress)) {
        await saveAddressToAccount(billingAddress, "BILLING");
      }
    }
  };

  const applySavedAddress = (address: SavedAddress) => {
    // Populate customer information from address
    if (address.firstName || address.lastName || address.phone) {
      const fullName = [address.firstName, address.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      
      setCustomerInfo((prev) => ({
        name: fullName || prev.name,
        email: prev.email || customer?.email || "",
        phone: address.phone || prev.phone || customer?.phone || "",
        company: prev.company || "",
      }));
    }

    if (address.type === "SHIPPING" || address.type === "BOTH") {
      setShippingAddress({
        street: address.street,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode ?? "",
        country: address.country,
      });
      setSelectedShippingAddressId(address.id);
      if (sameAsShipping) {
        setBillingAddress({
          street: address.street,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode ?? "",
          country: address.country,
        });
        setSelectedBillingAddressId(address.id);
      }
    } else {
      setBillingAddress({
        street: address.street,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode ?? "",
        country: address.country,
      });
      setSelectedBillingAddressId(address.id);
    }
  };

  const clearSelectedAddress = (type: AddressType) => {
    if (type === "SHIPPING") {
      setSelectedShippingAddressId(null);
      const cleared = {
        street: "",
        city: "",
        region: "",
        postalCode: "",
        country: "Ghana",
      };
      setShippingAddress(cleared);
      if (sameAsShipping) {
        setBillingAddress(cleared);
        setSelectedBillingAddressId(null);
      }
    } else {
      setSelectedBillingAddressId(null);
      setBillingAddress({
        street: "",
        city: "",
        region: "",
        postalCode: "",
        country: "Ghana",
      });
    }
  };

  const updateShippingAddress = (field: keyof typeof shippingAddress, value: string) => {
    const updated = {
      ...shippingAddress,
      [field]: value,
    };
    setSelectedShippingAddressId(null);
    setShippingAddress(updated);
    if (sameAsShipping) {
      setBillingAddress(updated);
    }
  };

  const updateBillingAddress = (field: keyof typeof billingAddress, value: string) => {
    setSelectedBillingAddressId(null);
    setBillingAddress({
      ...billingAddress,
      [field]: value,
    });
  };

  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/public/shop/cart");
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        router.push("/shop/cart");
        return;
      }
      
      setCart(data);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
      router.push("/shop/cart");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!cart || hasTrackedCheckout.current) {
      return;
    }

    if (!cart.items || cart.items.length === 0) {
      return;
    }

    hasTrackedCheckout.current = true;

    trackBeginCheckout({
      items: cart.items.map((item) => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        currency: item.currency,
        sku: item.sku ?? undefined,
      })),
      value: cart.total,
      currency: cart.items[0]?.currency ?? "GHS",
    });
  }, [cart]);


  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customerInfo.name) newErrors.name = "Name is required";
    if (!customerInfo.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(customerInfo.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!customerInfo.phone) newErrors.phone = "Phone number is required";

    if (!shippingAddress.street) newErrors.shippingStreet = "Street address is required";
    if (!shippingAddress.city) newErrors.shippingCity = "City is required";
    if (!shippingAddress.region) newErrors.shippingRegion = "Region is required";

    if (!sameAsShipping) {
      if (!billingAddress.street) newErrors.billingStreet = "Billing street is required";
      if (!billingAddress.city) newErrors.billingCity = "Billing city is required";
      if (!billingAddress.region) newErrors.billingRegion = "Billing region is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setProcessing(true);

      // First, create the order/invoice
      const checkoutResponse = await fetch("/api/public/shop/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: customerInfo,
          shippingAddress,
          billingAddress: sameAsShipping ? null : billingAddress,
          paymentMethod,
          notes,
        }),
      });

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json();
        
        // Handle specific error cases
        if (error.requiresAccount) {
          showError("Account Required", error.error || "Please create an account or log in to continue");
          setTimeout(() => {
            router.push("/shop/auth/login?redirect=/shop/checkout");
          }, 2000);
          setProcessing(false);
          return;
        }
        
        if (error.requiresEmailVerification) {
          showError("Email Verification Required", error.error || "Please verify your email address");
          setTimeout(() => {
            router.push("/shop/account");
          }, 2000);
          setProcessing(false);
          return;
        }
        
        showError(error.error || "Checkout failed", "Please check your information and try again");
        setProcessing(false);
        return;
      }

      const checkoutData = await checkoutResponse.json();
      await persistCurrentAddresses();
      // Get invoice number and ID from the checkout response
      const invoiceNumber = checkoutData.order?.invoiceNumber;
      const invoiceId = checkoutData.order?.invoiceId;
      if (!invoiceNumber && !invoiceId) {
        showError("Checkout failed", "Could not retrieve invoice information");
        setProcessing(false);
        return;
      }

      // If online payment, redirect to payment gateway
      if (paymentMethod === "ONLINE" || paymentMethod === "PAYSTACK") {
        setRedirectingToPayment(true);
        
        try {
          const paymentPayload = {
            ...(invoiceId ? { invoiceId } : {}),
            ...(invoiceNumber ? { invoiceNumber } : {}),
            paymentMethod: "ONLINE",
            amount: cart?.total || 0,
            customerEmail: customerInfo.email, // Pass customer email for guest checkout
          };
          
          console.log("Initiating payment with payload:", paymentPayload);
          
          const paymentResponse = await fetch("/api/public/shop/payment/initiate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paymentPayload),
          });

          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            
            if (paymentData.authorizationUrl) {
              // Redirect to payment gateway
              window.location.href = paymentData.authorizationUrl;
              return;
            } else {
              throw new Error("No authorization URL received from payment gateway");
            }
          } else {
            let error;
            try {
              error = await paymentResponse.json();
            } catch (e) {
              // Response is not JSON, get text instead
              const text = await paymentResponse.text();
              error = { error: text || `HTTP ${paymentResponse.status}: ${paymentResponse.statusText}` };
            }
            
            console.error("Payment API error response:", {
              status: paymentResponse.status,
              statusText: paymentResponse.statusText,
              error: error,
              headers: Object.fromEntries(paymentResponse.headers.entries())
            });
            
            const errorMessage = error.error || error.message || `Payment failed (${paymentResponse.status})`;
            throw new Error(errorMessage);
          }
        } catch (paymentError) {
          console.error("Payment initiation error:", paymentError);
          const errorMessage = paymentError instanceof Error 
            ? paymentError.message 
            : "Please try again or use a different payment method";
          showError(
            "Payment initiation failed",
            errorMessage
          );
          setRedirectingToPayment(false);
          setProcessing(false);
          return;
        }
      } else {
        // For non-online payments, complete the order normally
        setOrderDetails(checkoutData.order);
        setOrderComplete(true);
        success("Order placed successfully!", `Order #${checkoutData.order.invoiceNumber} has been created`);
        if (cart && cart.items?.length > 0) {
          trackPurchase({
            transactionId:
              checkoutData.order.orderNumber ||
              checkoutData.order.invoiceNumber ||
              checkoutData.order.quotationNumber,
            value: checkoutData.order.total ?? cart.total,
            currency:
              checkoutData.order.currency ||
              cart.items[0]?.currency ||
              "GHS",
            items: cart.items.map((item) => ({
              id: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              currency: item.currency,
              sku: item.sku ?? undefined,
            })),
          });
        }
        // Clear cart is handled by the API
      }
    } catch (error) {
      console.error("Checkout error:", error);
      showError("Checkout error", "An error occurred. Please try again");
    } finally {
      if (paymentMethod !== "ONLINE" && paymentMethod !== "PAYSTACK") {
        setProcessing(false);
      }
    }
  };

  const formatPrice = (price: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto animate-pulse">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your order. We've sent a confirmation email to {customerInfo.email}
              </p>

              <div className="bg-gray-50 rounded-lg p-6 text-left mb-6">
                <h3 className="font-semibold mb-3">Order Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium">{orderDetails.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium">
                      {formatPrice(orderDetails.total, orderDetails.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-green-600">{orderDetails.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/shop"
                  className="rounded-lg px-6 py-3 font-medium text-white transition hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
              <Link
                href="/shop/cart"
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mt-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Cart</span>
              </Link>
            </div>

          <form onSubmit={handleSubmit}>
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Checkout Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Information */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <User className="h-5 w-5 text-gray-400 mr-2" />
                    <h2 className="text-lg font-semibold">Customer Information</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.name ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                      {errors.name && (
                        <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.email ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                      {errors.email && (
                        <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.phone ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerInfo.company}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, company: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <Truck className="h-5 w-5 text-gray-400 mr-2" />
                    <h2 className="text-lg font-semibold">Shipping Address</h2>
                  </div>

                  <div className="space-y-4">
                    {shippingAddressOptions.length > 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-700">Saved shipping addresses</p>
                          <button
                            type="button"
                            onClick={() => clearSelectedAddress("SHIPPING")}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                          >
                            Use a new address
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {shippingAddressOptions.map((address) => {
                            const isSelected = selectedShippingAddressId === address.id;
                            return (
                              <button
                                key={address.id}
                                type="button"
                                onClick={() => applySavedAddress(address)}
                                className={cn(
                                  "flex h-full flex-col rounded-lg border bg-white px-4 py-3 text-left transition hover:shadow",
                                  isSelected ? "ring-2 ring-offset-2" : "focus:outline-none"
                                )}
                                style={
                                  isSelected
                                    ? {
                                        borderColor: themeColor,
                                        boxShadow: `0 0 0 2px ${hexToRgba(themeColor, 0.15)}`,
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: themeColor }} />
                                  <div className="space-y-1">
                                    <p className="font-semibold text-gray-900">{address.street}</p>
                                    <p>
                                      {address.city}, {address.region}
                                    </p>
                                    {address.postalCode ? <p>{address.postalCode}</p> : null}
                                    <p>{address.country}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.street}
                        onChange={(e) => updateShippingAddress("street", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.shippingStreet ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                      {errors.shippingStreet && (
                        <p className="text-red-500 text-xs mt-1">{errors.shippingStreet}</p>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                        onChange={(e) => updateShippingAddress("city", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            errors.shippingCity ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                        {errors.shippingCity && (
                          <p className="text-red-500 text-xs mt-1">{errors.shippingCity}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Region/State *
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.region}
                        onChange={(e) => updateShippingAddress("region", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            errors.shippingRegion ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                        {errors.shippingRegion && (
                          <p className="text-red-500 text-xs mt-1">{errors.shippingRegion}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.postalCode}
                        onChange={(e) => updateShippingAddress("postalCode", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.country}
                        onChange={(e) => updateShippingAddress("country", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center mt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsShipping}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSameAsShipping(checked);
                        if (checked) {
                          setBillingAddress({ ...shippingAddress });
                          setSelectedBillingAddressId(selectedShippingAddressId);
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Billing address same as shipping</span>
                  </label>
                </div>

                {/* Billing Address */}
                {!sameAsShipping && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Billing Address</h2>
                    
                    <div className="space-y-4">
                      {billingAddressOptions.length > 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Saved billing addresses</p>
                            <button
                              type="button"
                              onClick={() => clearSelectedAddress("BILLING")}
                              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                            >
                              Use a new address
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {billingAddressOptions.map((address) => {
                              const isSelected = selectedBillingAddressId === address.id;
                              return (
                                <button
                                  key={address.id}
                                  type="button"
                                  onClick={() => applySavedAddress(address)}
                                  className={cn(
                                    "flex h-full flex-col rounded-lg border bg-white px-4 py-3 text-left transition hover:shadow",
                                    isSelected ? "ring-2 ring-offset-2" : "focus:outline-none"
                                  )}
                                  style={
                                    isSelected
                                      ? {
                                          borderColor: themeColor,
                                          boxShadow: `0 0 0 2px ${hexToRgba(themeColor, 0.15)}`,
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: themeColor }} />
                                    <div className="space-y-1">
                                      <p className="font-semibold text-gray-900">{address.street}</p>
                                      <p>
                                        {address.city}, {address.region}
                                      </p>
                                      {address.postalCode ? <p>{address.postalCode}</p> : null}
                                      <p>{address.country}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          value={billingAddress.street}
                          onChange={(e) => updateBillingAddress("street", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            errors.billingStreet ? "border-red-500" : "border-gray-300"
                          }`}
                        />
                        {errors.billingStreet && (
                          <p className="text-red-500 text-xs mt-1">{errors.billingStreet}</p>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            value={billingAddress.city}
                            onChange={(e) => updateBillingAddress("city", e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              errors.billingCity ? "border-red-500" : "border-gray-300"
                            }`}
                          />
                          {errors.billingCity && (
                            <p className="text-red-500 text-xs mt-1">{errors.billingCity}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Region/State *
                          </label>
                          <input
                            type="text"
                            value={billingAddress.region}
                            onChange={(e) => updateBillingAddress("region", e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              errors.billingRegion ? "border-red-500" : "border-gray-300"
                            }`}
                          />
                          {errors.billingRegion && (
                            <p className="text-red-500 text-xs mt-1">{errors.billingRegion}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                    <h2 className="text-lg font-semibold">Payment Method</h2>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: "ONLINE", label: "Pay Online (Card/Mobile Money)", description: "Secure online payment via Paystack" },
                      { value: "CASH", label: "Cash on Delivery", description: "Pay when you receive your order" },
                      { value: "BANK_TRANSFER", label: "Bank Transfer", description: "Transfer funds directly to our account" },
                      { value: "MOBILE_MONEY", label: "Mobile Money", description: "Pay via MTN/Vodafone/AirtelTigo Mobile Money" },
                    ]
                      .filter((method) => availablePaymentMethods.length === 0 || availablePaymentMethods.includes(method.value))
                      .map((method) => (
                      <label key={method.value} className="flex items-start cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.value}
                          checked={paymentMethod === method.value}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mr-3 mt-1"
                        />
                        <div className="flex-1">
                          <span className="text-gray-700 font-medium block">{method.label}</span>
                          {method.description && (
                            <span className="text-gray-500 text-xs block mt-1">{method.description}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Order Notes */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Order Notes (Optional)</h2>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special instructions for your order..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow p-6 sticky top-6">
                  <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

                  {cart && (
                    <>
                      <div className="space-y-3 mb-4">
                        {cart.items.map((item) => (
                          <div key={item.productId} className="flex items-start space-x-3">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-12 w-12 object-cover rounded"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-sm font-medium">{formatPrice(item.lineTotal)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal</span>
                          <span>{formatPrice(cart.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>VAT (12.5%)</span>
                          <span>{formatPrice(cart.tax)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between text-lg font-semibold">
                            <span>Total</span>
                            <span>{formatPrice(cart.total)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={processing || redirectingToPayment}
                    className="mt-6 flex w-full items-center justify-center rounded-full px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: themeColor }}
                  >
                    {redirectingToPayment
                      ? "Redirecting to Payment..."
                      : processing
                      ? "Processing..."
                      : paymentMethod === "ONLINE" || paymentMethod === "PAYSTACK"
                      ? "Proceed to Payment"
                      : "Complete Order"}
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    By placing this order, you agree to our terms and conditions
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
