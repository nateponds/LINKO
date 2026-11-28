/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import Toast from "../../components/ui/Toast";
import {
  addCartLine,
  cartCount,
  clearStoredCart,
  readStoredCart,
  removeCartLine,
  removeCartLines,
  setCartLineQuantity,
  shouldClearStoredCart,
  writeStoredCart,
} from "./cart";

const CartContext = createContext(null);

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const [cart, setCart] = useState({});
  const [cartUserId, setCartUserId] = useState(userId);
  const cartRef = useRef(cart);
  const previousUserId = useRef(userId);
  const [notice, setNotice] = useState(null);
  const noticeId = useRef(0);
  const dismissNotice = useCallback(() => setNotice(null), []);

  if (cartUserId !== userId) {
    const next = userId ? readStoredCart(browserStorage(), userId) : {};
    setCartUserId(userId);
    setCart(next);
    setNotice(null);
  }

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    const previous = previousUserId.current;
    if (shouldClearStoredCart(previous, userId)) {
      clearStoredCart(browserStorage(), previous);
    }
    previousUserId.current = userId;
  }, [userId]);

  const replaceCart = useCallback((next) => {
    cartRef.current = next;
    setCart(next);
    if (userId) writeStoredCart(browserStorage(), userId, next);
  }, [userId]);

  const addProduct = useCallback((product, quantity = 1) => {
    const result = addCartLine(cartRef.current, product, quantity);
    if (!result.error) replaceCart(result.cart);
    setNotice({
      id: ++noticeId.current,
      userId,
      variant: result.error ? "error" : "success",
      title: result.error ? "Couldn’t add to cart" : "Added to cart",
      message: result.error ?? product.product_name,
    });
    return result;
  }, [replaceCart, userId]);

  const updateQuantity = useCallback((productId, quantity) => {
    replaceCart(setCartLineQuantity(cartRef.current, productId, quantity));
  }, [replaceCart]);

  const removeProduct = useCallback((productId) => {
    replaceCart(removeCartLine(cartRef.current, productId));
  }, [replaceCart]);

  const removeProducts = useCallback((productIds) => {
    replaceCart(removeCartLines(cartRef.current, productIds));
  }, [replaceCart]);

  const value = useMemo(() => {
    const visibleCart = cartUserId === userId ? cart : {};
    return {
      cart: visibleCart,
      count: cartCount(visibleCart),
      addProduct,
      updateQuantity,
      removeProduct,
      removeProducts,
    };
  }, [addProduct, cart, cartUserId, removeProduct, removeProducts, updateQuantity, userId]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <Toast
        notification={notice?.userId === userId ? notice : null}
        duration={notice?.variant === "error" ? 6000 : 4000}
        onDismiss={dismissNotice}
        action={notice?.variant === "success" ? <Link to="/cart" onClick={dismissNotice}>View cart</Link> : null}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
