import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./modal-portal.css";

let openCount = 0;

/**
 * Renders a dialog at the end of <body> so its backdrop covers (and blurs) the whole
 * page, sidebar included, instead of only the page section that opened it.
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    openCount += 1;
    document.body.classList.add("modal-open");
    return () => {
      openCount -= 1;
      if (openCount === 0) document.body.classList.remove("modal-open");
    };
  }, []);

  return createPortal(<div className="modal-layer">{children}</div>, document.body);
}
