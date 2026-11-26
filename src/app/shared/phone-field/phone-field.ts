import { Component, computed, forwardRef, inject, input, signal } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { ShopSettingsService } from "../../core/shop/shop-settings.service";
import { countryName } from "../country-codes";
import { groupNational, splitPhone, toInternational } from "../phone";

let nextId = 0;

// Indicatif du pays + numéro. La valeur du formulaire est le numéro international
// (+226 66 09 90 60), ou vide quand aucun numéro n'est saisi.
@Component({
    selector: "app-phone-field",
    templateUrl: "./phone-field.html",
    styleUrl: "./phone-field.css",
    providers: [
        { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneField), multi: true },
    ],
})
export class PhoneField implements ControlValueAccessor {
    private shop = inject(ShopSettingsService);

    // Sans libellé visible (caisse), le champ garde un libellé pour les lecteurs d'écran
    label = input("");
    optional = input(false);
    ariaLabel = input("Téléphone");
    invalid = input(false);
    showCountry = input(true);
    placeholder = input("Numéro");
    // Indicatif proposé tant que rien n'est choisi (inscription : la boutique n'existe pas encore)
    initialCode = input<string | null>(null);

    protected labelId = `phone-field-${nextId++}`;
    protected disabled = signal(false);

    // null tant que l'utilisateur n'a pas touché à l'indicatif : on suit celui de la boutique
    private chosenCode = signal<string | null>(null);
    protected code = computed(
        () => this.chosenCode() ?? this.initialCode() ?? this.shop.defaultCountryCode(),
    );
    protected national = signal("");
    protected country = computed(() => countryName(this.code()));

    private onChange: (value: string) => void = () => {};
    private onTouched: () => void = () => {};

    writeValue(value: string | null) {
        if (!value?.trim()) {
            this.chosenCode.set(null);
            this.national.set("");
            return;
        }

        const { code, national } = splitPhone(value, this.shop.defaultCountryCode());
        this.chosenCode.set(code);
        this.national.set(groupNational(national));
    }

    registerOnChange(fn: (value: string) => void) {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void) {
        this.onTouched = fn;
    }

    setDisabledState(disabled: boolean) {
        this.disabled.set(disabled);
    }

    protected onCodeInput(input: HTMLInputElement) {
        // 4 chiffres au plus, jamais de 0 au début
        const digits = input.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);
        input.value = digits;
        this.chosenCode.set(digits);
        this.emit();
    }

    protected onNumberInput(input: HTMLInputElement) {
        // Un numéro collé avec son indicatif (+226 66 09 90 60) remplit les deux champs
        if (/^\s*(\+|00)/.test(input.value)) {
            const { code, national } = splitPhone(input.value, this.shop.defaultCountryCode());
            this.chosenCode.set(code);
            this.national.set(groupNational(national));
            input.value = this.national();
            this.emit();
            return;
        }

        // Le texte reste tel que tapé, il est mis en forme en quittant le champ
        const typed = input.value.replace(/[^\d ]/g, "");
        input.value = typed;
        this.national.set(typed);
        this.emit();
    }

    protected onBlur(numberInput: HTMLInputElement) {
        // Un indicatif vidé revient à celui de la boutique
        if (!this.chosenCode()) this.chosenCode.set(null);

        const grouped = groupNational(this.national().replace(/\D/g, ""));
        this.national.set(grouped);
        numberInput.value = grouped;
        this.onTouched();
    }

    private emit() {
        const code = this.code() || this.initialCode() || this.shop.defaultCountryCode();
        this.onChange(toInternational(code, this.national()));
    }
}
