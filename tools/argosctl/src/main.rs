mod config;
mod protocol;

use clap::{Parser, Subcommand};
use config::ArgosConfig;
use protocol::ArgosDevice;
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

const DEFAULT_LAYER_NAMES: [&str; 4] = ["base", "lower", "raise", "pointer"];

#[derive(Parser)]
#[command(version, about = "Back up and restore Argos keyboard configuration")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Export an Argos-compatible JSON backup
    Backup {
        /// Backup path, or - for standard output
        #[arg(short, long, default_value = "argos_config.json")]
        output: PathBuf,

        /// Replace an existing output file
        #[arg(long)]
        force: bool,

        /// Suppress the success message
        #[arg(short, long)]
        quiet: bool,

        /// USB vendor ID, in decimal or 0x-prefixed hexadecimal
        #[arg(long, default_value = "0xA8F8", value_parser = parse_u16)]
        vid: u16,

        /// USB product ID, in decimal or 0x-prefixed hexadecimal
        #[arg(long, default_value = "0x1833", value_parser = parse_u16)]
        pid: u16,

        /// Dynamic keymap matrix rows
        #[arg(long, default_value_t = 10)]
        rows: usize,

        /// Dynamic keymap matrix columns
        #[arg(long, default_value_t = 6)]
        cols: usize,

        /// Layer name, repeated in layer order
        #[arg(long = "layer-name")]
        layer_names: Vec<String>,

        /// Wait until a matching keyboard becomes available
        #[arg(long)]
        wait: bool,

        /// Require the connected keyboard to report the right half
        #[arg(long)]
        require_right_half: bool,
    },

    /// Restore and verify an Argos-compatible JSON backup
    Restore {
        /// Backup path
        #[arg(short, long, default_value = "argos_config.json")]
        input: PathBuf,

        /// Suppress the success message
        #[arg(short, long)]
        quiet: bool,

        /// Wait until a matching keyboard becomes available
        #[arg(long)]
        wait: bool,

        /// Require the connected keyboard to report the right half
        #[arg(long)]
        require_right_half: bool,

        /// USB vendor ID, in decimal or 0x-prefixed hexadecimal
        #[arg(long, default_value = "0xA8F8", value_parser = parse_u16)]
        vid: u16,

        /// USB product ID, in decimal or 0x-prefixed hexadecimal
        #[arg(long, default_value = "0x1833", value_parser = parse_u16)]
        pid: u16,
    },
}

fn main() {
    if let Err(error) = run() {
        eprintln!("argosctl: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    match Cli::parse().command {
        Command::Backup {
            output,
            force,
            quiet,
            vid,
            pid,
            rows,
            cols,
            layer_names,
            wait,
            require_right_half,
        } => backup(BackupOptions {
            output,
            force,
            quiet,
            vid,
            pid,
            rows,
            cols,
            layer_names,
            wait,
            require_right_half,
        }),
        Command::Restore {
            input,
            quiet,
            wait,
            require_right_half,
            vid,
            pid,
        } => restore(RestoreOptions {
            input,
            quiet,
            wait,
            require_right_half,
            vid,
            pid,
        }),
    }
}

struct BackupOptions {
    output: PathBuf,
    force: bool,
    quiet: bool,
    vid: u16,
    pid: u16,
    rows: usize,
    cols: usize,
    layer_names: Vec<String>,
    wait: bool,
    require_right_half: bool,
}

fn backup(options: BackupOptions) -> Result<(), String> {
    if options.rows == 0 || options.cols == 0 {
        return Err("rows and cols must both be greater than zero".to_owned());
    }
    if options.output != Path::new("-") && options.output.exists() && !options.force {
        return Err(format!(
            "{} already exists; choose another path or pass --force",
            options.output.display()
        ));
    }

    let (device, keyboard_info) = open_device(
        options.vid,
        options.pid,
        options.wait,
        options.require_right_half,
    )?;
    let via_protocol_version = device.via_protocol_version()?;
    if keyboard_info.argos_protocol_version == 0 {
        return Err("connected keyboard does not report Argos support".to_owned());
    }
    let layer_count = device.layer_count()?;
    let keycodes = device.keymap(layer_count, options.rows, options.cols)?;
    let combos = device.combos(keyboard_info.combo_amount, keyboard_info.keys_per_combo)?;
    let tap_dances = device.tap_dances(keyboard_info.tap_dance_amount)?;
    let pointing = device.pointing_device_info()?;
    let layer_names = make_layer_names(options.layer_names, layer_count)?;

    let config = ArgosConfig {
        via_protocol_version,
        argos_protocol_version: keyboard_info.argos_protocol_version,
        qmk_keycodes_version: keyboard_info.qmk_keycodes_version,
        tap_dance_amount: keyboard_info.tap_dance_amount,
        combo_amount: keyboard_info.combo_amount,
        keys_per_combo: keyboard_info.keys_per_combo,
        theme_id: keyboard_info.theme_id,
        // Argos leaves these defaults in place when the keyboard has no RGB support.
        rgb_brightness: 50,
        rgb_effect_speed: 50,
        rgb_effect_type: 0,
        rgb_hue: 0,
        rgb_sat: 0,
        pointing_device_type: pointing.pointing_device_type,
        default_dpi: pointing.default_dpi,
        minimum_default_dpi: pointing.minimum_default_dpi,
        default_dpi_config_step: pointing.default_dpi_config_step,
        sniping_dpi: pointing.sniping_dpi,
        minimum_sniping_dpi: pointing.minimum_sniping_dpi,
        sniping_dpi_config_step: pointing.sniping_dpi_config_step,
        default_dpi_max_steps: pointing.default_dpi_max_steps,
        sniping_dpi_max_steps: pointing.sniping_dpi_max_steps,
        keycodes,
        layer_names,
        combos,
        tap_dances,
        rows: options.rows,
        cols: options.cols,
        has_displayed_welcome_message: keyboard_info.has_displayed_welcome_message,
        tapping_term: keyboard_info.tapping_term,
        combo_term: keyboard_info.combo_term,
        is_via_only: false,
        is_left_handed: keyboard_info.is_left_handed,
        auto_mouse_layer_enabled: keyboard_info.auto_mouse_layer_enabled,
        auto_precision_on_mouse_layer_enabled: keyboard_info.auto_precision_on_mouse_layer_enabled,
        rgb_matrix: BTreeMap::new(),
    };

    let json = serde_json::to_vec_pretty(&config)
        .map_err(|error| format!("could not serialize backup: {error}"))?;
    write_output(&options.output, options.force, &json)?;

    if !options.quiet && options.output != Path::new("-") {
        eprintln!(
            "Backed up {} layers, {} combos, and {} tap dances to {}",
            layer_count,
            keyboard_info.combo_amount,
            keyboard_info.tap_dance_amount,
            options.output.display()
        );
    }
    Ok(())
}

struct RestoreOptions {
    input: PathBuf,
    quiet: bool,
    wait: bool,
    require_right_half: bool,
    vid: u16,
    pid: u16,
}

fn restore(options: RestoreOptions) -> Result<(), String> {
    let bytes = fs::read(&options.input)
        .map_err(|error| format!("could not read {}: {error}", options.input.display()))?;
    let config: ArgosConfig = serde_json::from_slice(&bytes)
        .map_err(|error| format!("could not parse {}: {error}", options.input.display()))?;
    validate_restore_config(&config)?;

    let (device, keyboard_info) = open_device(
        options.vid,
        options.pid,
        options.wait,
        options.require_right_half,
    )?;
    if keyboard_info.argos_protocol_version < config.argos_protocol_version {
        return Err(format!(
            "keyboard Argos protocol {} is older than backup protocol {}",
            keyboard_info.argos_protocol_version, config.argos_protocol_version
        ));
    }
    if keyboard_info.qmk_keycodes_version != config.qmk_keycodes_version {
        return Err(format!(
            "QMK keycode version mismatch: keyboard {:?}, backup {:?}",
            keyboard_info.qmk_keycodes_version, config.qmk_keycodes_version
        ));
    }
    if keyboard_info.keys_per_combo as usize != config.keys_per_combo as usize {
        return Err(format!(
            "combo width mismatch: keyboard {}, backup {}",
            keyboard_info.keys_per_combo, config.keys_per_combo
        ));
    }
    let layer_count = device.layer_count()?;
    if layer_count != config.keycodes.len() {
        return Err(format!(
            "layer count mismatch: keyboard {layer_count}, backup {}",
            config.keycodes.len()
        ));
    }
    if keyboard_info.combo_amount as usize != config.combos.len() {
        return Err(format!(
            "combo count mismatch: keyboard {}, backup {}",
            keyboard_info.combo_amount,
            config.combos.len()
        ));
    }
    if keyboard_info.tap_dance_amount as usize != config.tap_dances.len() {
        return Err(format!(
            "tap-dance count mismatch: keyboard {}, backup {}",
            keyboard_info.tap_dance_amount,
            config.tap_dances.len()
        ));
    }

    device.set_keymap(&config.keycodes, config.rows, config.cols)?;
    for (index, combo) in config.combos.iter().enumerate() {
        device.set_combo(index as u8, combo, keyboard_info.argos_protocol_version)?;
    }
    for (index, tap_dance) in config.tap_dances.iter().enumerate() {
        device.set_tap_dance(index as u8, tap_dance, keyboard_info.argos_protocol_version)?;
    }
    device.set_theme_id(config.theme_id)?;
    device.set_welcome_message_displayed(config.has_displayed_welcome_message)?;
    device.set_tapping_term(config.tapping_term)?;
    device.set_combo_term(config.combo_term)?;
    device.set_default_dpi(config.default_dpi)?;
    device.set_sniping_dpi(config.sniping_dpi)?;

    verify_restore(&device, &config)?;
    if !options.quiet {
        eprintln!(
            "Restored and verified {} layers, {} combos, and {} tap dances from {}",
            config.keycodes.len(),
            config.combos.len(),
            config.tap_dances.len(),
            options.input.display()
        );
    }
    Ok(())
}

fn validate_restore_config(config: &ArgosConfig) -> Result<(), String> {
    if config.rows == 0 || config.cols == 0 {
        return Err("backup rows and cols must both be greater than zero".to_owned());
    }
    let layer_size = config
        .rows
        .checked_mul(config.cols)
        .ok_or_else(|| "backup keymap dimensions overflowed".to_owned())?;
    for (index, layer) in config.keycodes.iter().enumerate() {
        if layer.len() != layer_size {
            return Err(format!(
                "backup layer {index} has {} keycodes; expected {layer_size}",
                layer.len()
            ));
        }
    }
    for (index, combo) in config.combos.iter().enumerate() {
        if combo.input.len() != config.keys_per_combo as usize {
            return Err(format!(
                "backup combo {index} has {} input slots; expected {}",
                combo.input.len(),
                config.keys_per_combo
            ));
        }
    }
    Ok(())
}

fn verify_restore(device: &ArgosDevice, expected: &ArgosConfig) -> Result<(), String> {
    let actual_info = device.keyboard_info()?;
    let actual_keymap = device.keymap(expected.keycodes.len(), expected.rows, expected.cols)?;
    if actual_keymap != expected.keycodes {
        return Err("keymap verification failed after restore".to_owned());
    }
    let actual_combos = device.combos(expected.combos.len() as u8, expected.keys_per_combo)?;
    if actual_combos != expected.combos {
        return Err("combo verification failed after restore".to_owned());
    }
    let actual_tap_dances = device.tap_dances(expected.tap_dances.len() as u8)?;
    if actual_tap_dances != expected.tap_dances {
        return Err("tap-dance verification failed after restore".to_owned());
    }
    let actual_pointing = device.pointing_device_info()?;
    if actual_info.theme_id != expected.theme_id
        || actual_info.has_displayed_welcome_message != expected.has_displayed_welcome_message
        || actual_info.tapping_term != expected.tapping_term
        || actual_info.combo_term != expected.combo_term
        || actual_pointing.default_dpi != expected.default_dpi
        || actual_pointing.sniping_dpi != expected.sniping_dpi
    {
        return Err("global-setting verification failed after restore".to_owned());
    }
    Ok(())
}

fn open_device(
    vid: u16,
    pid: u16,
    wait: bool,
    require_right_half: bool,
) -> Result<(ArgosDevice, config::KeyboardInfo), String> {
    let mut last_error = None;
    loop {
        let attempt = ArgosDevice::open(vid, pid).and_then(|device| {
            let info = device.keyboard_info()?;
            if require_right_half {
                let controller_is_left = if info.argos_protocol_version >= 4 {
                    device.controller_is_left()?
                } else {
                    info.is_left_handed
                };
                if controller_is_left {
                    return Err("connected Argos device is the left half; connect the right/trackball half over normal USB".to_owned());
                }
            }
            Ok((device, info))
        });
        match attempt {
            Ok(result) => return Ok(result),
            Err(error) if !wait => return Err(error),
            Err(error) => {
                if last_error.as_deref() != Some(error.as_str()) {
                    eprintln!("Waiting for Argos device: {error}");
                    last_error = Some(error);
                }
                thread::sleep(Duration::from_millis(500));
            }
        }
    }
}

fn make_layer_names(given: Vec<String>, count: usize) -> Result<Vec<String>, String> {
    if given.len() > count {
        return Err(format!(
            "received {} layer names for a {count}-layer keymap",
            given.len()
        ));
    }
    let mut names = if given.is_empty() {
        DEFAULT_LAYER_NAMES
            .iter()
            .take(count)
            .map(|name| (*name).to_owned())
            .collect()
    } else {
        given
    };
    while names.len() < count {
        names.push(format!("layer {}", names.len()));
    }
    Ok(names)
}

fn write_output(path: &Path, force: bool, bytes: &[u8]) -> Result<(), String> {
    if path == Path::new("-") {
        let mut stdout = io::stdout().lock();
        stdout
            .write_all(bytes)
            .and_then(|()| stdout.write_all(b"\n"))
            .map_err(|error| format!("could not write backup to stdout: {error}"))?;
        return Ok(());
    }

    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "could not create backup directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let mut options = OpenOptions::new();
    options.write(true).create(true);
    if force {
        options.truncate(true);
    } else {
        options.create_new(true);
    }
    let mut file = options
        .open(path)
        .map_err(|error| format!("could not create {}: {error}", path.display()))?;
    file.write_all(bytes)
        .and_then(|()| file.write_all(b"\n"))
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("could not write {}: {error}", path.display()))
}

fn parse_u16(value: &str) -> Result<u16, String> {
    if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        u16::from_str_radix(hex, 16).map_err(|error| error.to_string())
    } else {
        value.parse::<u16>().map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_decimal_and_hex_usb_ids() {
        assert_eq!(parse_u16("6195").unwrap(), 6195);
        assert_eq!(parse_u16("0x1833").unwrap(), 0x1833);
    }

    #[test]
    fn completes_default_layer_names() {
        assert_eq!(
            make_layer_names(Vec::new(), 5).unwrap(),
            ["base", "lower", "raise", "pointer", "layer 4"]
        );
    }
}
