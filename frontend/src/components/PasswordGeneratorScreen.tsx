import PasswordGenerator from "./PasswordGenerator";

const PasswordGeneratorScreen = () => {
  return (
    <div className="min-h-full p-5">
      <div className="flex items-center gap-2">
        <img
          src="/icons/logo.png"
          alt="Passkeys"
          className="h-8 w-8 rounded-lg"
        />
        <h1 className="text-lg font-semibold">Генератор паролей</h1>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-panel p-4">
        <PasswordGenerator />
      </div>
    </div>
  );
};

export default PasswordGeneratorScreen;
