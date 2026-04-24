export class AppConfig {
    static today() {
        return new Date().toISOString().slice(0, 10);
    }

    static fields = ["Ticker", "Nombre", "FechaC", "Cantidad", "PrecioC", "FechaV", "PrecioV", "PrecioA"];
    static fieldSlugs = AppConfig.fields.map(field => field.toLowerCase());
    static tabNames = [
        "HEU500 6m b1 1m t20 r0",
        "SP500 Heus + Fin Data Wk",
        "Rusell1000 Heus + Fin Data Wk",
    ];
    static minDeposit = 1000;
}
