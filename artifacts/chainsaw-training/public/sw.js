self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Chainsaw Courses", body: event.data.text() }; }

  const title = payload.title ?? "Chainsaw Courses News";
  const options = {
    body: payload.body ?? "A new article has been posted.",
    icon: self.registration.scope + "favicon.svg",
    badge: self.registration.scope + "favicon.svg",
    data: { url: payload.url ?? self.registration.scope + "news" },
    tag: "news-update",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
