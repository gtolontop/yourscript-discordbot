export default function Loading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-discord-blurple mx-auto mb-3" />
        <p className="text-sm text-discord-muted">{message}</p>
      </div>
    </div>
  );
}
