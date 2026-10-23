(() => {
  const header = document.querySelector(".site-header");
  if (header) {
    const measureHeader = () =>
      document.documentElement.style.setProperty(
        "--teacher-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    measureHeader();
    if (typeof ResizeObserver !== "undefined")
      new ResizeObserver(measureHeader).observe(header);
    else window.addEventListener("resize", measureHeader);
  }
  const popup = document.querySelector("#gallery-lightbox");
  if (!popup) return;
  const image = popup.querySelector("#lightbox-image");
  const title = popup.querySelector("#lightbox-caption-title");
  const caption = popup.querySelector("#lightbox-caption-text");
  const counter = popup.querySelector("#lightbox-counter");
  const status = popup.querySelector("#lightbox-status");
  const original = popup.querySelector("#lightbox-original");
  const previous = popup.querySelector(".gallery-lightbox-prev");
  const next = popup.querySelector(".gallery-lightbox-next");
  const photos = [
    ...document.querySelectorAll("#photo-gallery .photo-card"),
  ].map((card) => {
    const thumb = card.querySelector("img");
    return {
      src: thumb.dataset.full || thumb.src,
      alt: thumb.alt,
      title: card.querySelector("figcaption b").textContent,
      caption: card.querySelector("figcaption span").textContent,
      trigger: card.querySelector("button"),
    };
  });
  let index = 0;
  let opener;
  function render(value) {
    index = (value + photos.length) % photos.length;
    const photo = photos[index];
    status.textContent = "Загружаю фото…";
    title.textContent = photo.title;
    caption.textContent = photo.caption;
    counter.textContent = `${index + 1} / ${photos.length}`;
    image.alt = photo.alt;
    original.href = photo.src;
    image.src = photo.src;
    previous.disabled = next.disabled = photos.length < 2;
  }
  function open(value) {
    if (!photos.length) return;
    opener = document.activeElement;
    render(value);
    if (!popup.open) popup.showModal();
    document.body.classList.add("lightbox-open");
    popup.querySelector(".gallery-lightbox-close").focus();
  }
  function close() {
    if (popup.open) popup.close();
  }
  photos.forEach((photo, i) =>
    photo.trigger.addEventListener("click", () => open(i)),
  );
  document
    .querySelectorAll("[data-gallery-open]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        open(Number(button.dataset.galleryOpen)),
      ),
    );
  popup
    .querySelectorAll("[data-lightbox-close]")
    .forEach((button) => button.addEventListener("click", close));
  previous.addEventListener("click", () => render(index - 1));
  next.addEventListener("click", () => render(index + 1));
  popup.addEventListener("close", () => {
    document.body.classList.remove("lightbox-open");
    if (opener?.isConnected) opener.focus();
  });
  popup.addEventListener("keydown", (event) => {
    if (!popup.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Tab") {
      const controls = [
        ...popup.querySelectorAll("button:not([disabled]), a[href]"),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      render(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  image.addEventListener("load", () => {
    status.textContent = "";
  });
  image.addEventListener("error", () => {
    status.textContent =
      "Фото не загрузилось. Попробуйте открыть его по ссылке ниже.";
  });
})();
