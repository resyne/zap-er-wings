export function WebmailPage() {
  return (
    <div className="h-screen w-full flex flex-col">
      <div className="flex-1 w-full">
        <iframe
          src="https://webmail.abbattitorizapper.it/"
          className="w-full h-full border-0"
          title="Webmail"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
