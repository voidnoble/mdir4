use serde::{Deserialize, Serialize};

const CSS_PX_PER_POINT: f64 = 96.0 / 72.0;

type FontResult = Result<Option<SelectedFont>, String>;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontSelection {
    pub name: String,
    /// CSS pixel size used by the existing settings format.
    pub size: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedFont {
    pub name: String,
    /// CSS pixel size used by the existing settings format.
    pub size: f64,
}

fn points_to_css_px(points: f64) -> f64 {
    points * CSS_PX_PER_POINT
}

fn css_px_to_points(px: f64) -> f64 {
    px / CSS_PX_PER_POINT
}

#[tauri::command]
pub async fn font_select(window: tauri::WebviewWindow, initial: FontSelection) -> FontResult {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let ui_window = window.clone();
    window
        .run_on_main_thread(move || {
            #[cfg(target_os = "windows")]
            let result = ui_window
                .hwnd()
                .map_err(|error| error.to_string())
                .and_then(|hwnd| windows::select(hwnd.0, initial));

            #[cfg(target_os = "macos")]
            let result = macos::select(&ui_window, initial);

            #[cfg(target_os = "linux")]
            let result = linux::select(&ui_window, initial);

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            let result: FontResult =
                Err("Native font selection is not supported on this platform".to_string());

            let _ = sender.send(result);
        })
        .map_err(|error| error.to_string())?;

    receiver.await.map_err(|error| error.to_string())?
}

#[cfg(target_os = "windows")]
mod windows {
    use super::{css_px_to_points, points_to_css_px, FontResult, FontSelection, SelectedFont};
    use std::mem::size_of;
    use std::ptr;
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::{
        GetDC, GetDeviceCaps, ReleaseDC, LOGFONTW, LOGPIXELSY,
    };
    use windows_sys::Win32::UI::Controls::Dialogs::{
        ChooseFontW, CommDlgExtendedError, CF_INITTOLOGFONTSTRUCT, CHOOSEFONTW,
    };

    pub fn select(hwnd: HWND, initial: FontSelection) -> FontResult {
        let mut log_font = LOGFONTW::default();
        for (target, source) in log_font
            .lfFaceName
            .iter_mut()
            .zip(initial.name.encode_utf16())
        {
            *target = source;
        }

        let hdc = unsafe { GetDC(hwnd) };
        let dpi = if hdc.is_null() {
            96
        } else {
            unsafe { GetDeviceCaps(hdc, LOGPIXELSY) }
        }
        .max(1);
        log_font.lfHeight = -((initial.size * dpi as f64 / 96.0).round() as i32);

        let mut choose_font = CHOOSEFONTW {
            lStructSize: size_of::<CHOOSEFONTW>() as u32,
            hwndOwner: hwnd,
            hDC: hdc,
            lpLogFont: &mut log_font,
            iPointSize: 0,
            Flags: CF_INITTOLOGFONTSTRUCT,
            rgbColors: 0,
            lCustData: 0,
            lpfnHook: None,
            lpTemplateName: ptr::null(),
            hInstance: ptr::null_mut(),
            lpszStyle: ptr::null_mut(),
            nFontType: 0,
            ___MISSING_ALIGNMENT__: 0,
            nSizeMin: 0,
            nSizeMax: 0,
        };

        let selected = unsafe { ChooseFontW(&mut choose_font) };
        if !hdc.is_null() {
            unsafe { ReleaseDC(hwnd, hdc) };
        }
        if selected == 0 {
            let error = unsafe { CommDlgExtendedError() };
            if error == 0 {
                return Ok(None);
            }
            return Err(format!(
                "Windows font chooser failed (common-dialog error 0x{error:04x})"
            ));
        }

        let end = log_font
            .lfFaceName
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(log_font.lfFaceName.len());
        let name = String::from_utf16_lossy(&log_font.lfFaceName[..end]);
        if name.is_empty() {
            return Err("Windows font chooser returned an empty family name".to_string());
        }

        Ok(Some(SelectedFont {
            name,
            size: points_to_css_px(choose_font.iPointSize as f64 / 10.0),
        }))
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::{css_px_to_points, points_to_css_px, FontResult, FontSelection, SelectedFont};
    use gtk::prelude::*;

    pub fn select(window: &tauri::WebviewWindow, initial: FontSelection) -> FontResult {
        let parent = window.gtk_window().map_err(|error| error.to_string())?;
        let dialog = gtk::FontChooserDialog::new(Some("Select Font"), Some(&parent));
        let font_description = pango::FontDescription::from_string(&format!(
            "{} {}",
            initial.name,
            css_px_to_points(initial.size)
        ));
        dialog.set_font_desc(&font_description);

        let response = dialog.run();
        let selected = if response == gtk::ResponseType::Ok {
            let description = dialog
                .font_desc()
                .ok_or_else(|| "GTK font chooser returned no font".to_string())?;
            let name = description
                .family()
                .map(|family| family.to_string())
                .filter(|family| !family.is_empty())
                .ok_or_else(|| "GTK font chooser returned no family name".to_string())?;
            let size = description.size() as f64 / pango::SCALE as f64;
            if size <= 0.0 {
                return Err("GTK font chooser returned an invalid font size".to_string());
            }
            Some(SelectedFont {
                name,
                size: points_to_css_px(size),
            })
        } else {
            None
        };
        dialog.close();
        Ok(selected)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{css_px_to_points, points_to_css_px, FontResult, FontSelection, SelectedFont};
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{define_class, msg_send, sel, DefinedClass, MainThreadOnly};
    use objc2_app_kit::{
        NSApplication, NSButton, NSFont, NSFontChanging, NSFontManager, NSFontPanel,
        NSModalResponseCancel, NSModalResponseOK, NSView, NSWindow, NSWindowDelegate,
        NSWindowOrderingMode,
    };
    use objc2_foundation::{
        MainThreadMarker, NSNotification, NSObject, NSObjectProtocol, NSPoint, NSRect, NSSize,
        NSString,
    };
    use std::cell::RefCell;

    struct FontPickerIvars {
        sender: RefCell<Option<tokio::sync::oneshot::Sender<FontResult>>>,
        selected: RefCell<SelectedFont>,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[ivars = FontPickerIvars]
        struct FontPickerTarget;

        unsafe impl NSObjectProtocol for FontPickerTarget {}

        unsafe impl NSFontChanging for FontPickerTarget {
            #[unsafe(method(changeFont:))]
            fn change_font(&self, manager: Option<&NSFontManager>) {
                if let Some(font) = manager.and_then(|manager| manager.selectedFont()) {
                    if let Some(name) = font.familyName() {
                        self.ivars().selected.replace(SelectedFont {
                            name: name.to_string(),
                            size: points_to_css_px(font.pointSize()),
                        });
                    }
                }
            }
        }

        unsafe impl NSWindowDelegate for FontPickerTarget {
            #[unsafe(method(windowWillClose:))]
            fn window_will_close(&self, _notification: &NSNotification) {
                self.finish(None, NSModalResponseCancel);
            }
        }

        impl FontPickerTarget {
            #[unsafe(method(acceptFont:))]
            fn accept_font(&self, _sender: Option<&AnyObject>) {
                self.finish(Some(self.ivars().selected.borrow().clone()), NSModalResponseOK);
            }

            #[unsafe(method(cancelFont:))]
            fn cancel_font(&self, _sender: Option<&AnyObject>) {
                self.finish(None, NSModalResponseCancel);
            }
        }
    );

    impl FontPickerTarget {
        fn new(
            mtm: MainThreadMarker,
            initial: SelectedFont,
            sender: tokio::sync::oneshot::Sender<FontResult>,
        ) -> Retained<Self> {
            let this = Self::alloc(mtm).set_ivars(FontPickerIvars {
                sender: RefCell::new(Some(sender)),
                selected: RefCell::new(initial),
            });
            // SAFETY: NSObject's init method is valid for this subclass.
            unsafe { msg_send![super(this), init] }
        }

        fn finish(&self, selected: Option<SelectedFont>, response: isize) {
            if let Some(sender) = self.ivars().sender.borrow_mut().take() {
                let _ = sender.send(Ok(selected));
                NSApplication::sharedApplication(self.mtm()).stopModalWithCode(response);
            }
        }

        fn make_accessory(&self, mtm: MainThreadMarker) -> Retained<NSView> {
            let view = NSView::initWithFrame(
                NSView::alloc(mtm),
                NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(220.0, 38.0)),
            );
            let cancel = unsafe {
                NSButton::buttonWithTitle_target_action(
                    &NSString::from_str("취소"),
                    Some(self),
                    Some(sel!(cancelFont:)),
                    mtm,
                )
            };
            let ok = unsafe {
                NSButton::buttonWithTitle_target_action(
                    &NSString::from_str("확인"),
                    Some(self),
                    Some(sel!(acceptFont:)),
                    mtm,
                )
            };
            cancel.setFrame(NSRect::new(
                NSPoint::new(116.0, 7.0),
                NSSize::new(88.0, 24.0),
            ));
            ok.setFrame(NSRect::new(
                NSPoint::new(20.0, 7.0),
                NSSize::new(88.0, 24.0),
            ));
            view.addSubview(&cancel);
            view.addSubview(&ok);
            view
        }
    }

    pub fn select(window: &tauri::WebviewWindow, initial: FontSelection) -> FontResult {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "AppKit main thread is unavailable".to_string())?;
        let initial_point_size = css_px_to_points(initial.size).max(1.0);
        let font_name = NSString::from_str(&initial.name);
        let initial_font = NSFont::fontWithName_size(&font_name, initial_point_size)
            .unwrap_or_else(|| NSFont::systemFontOfSize(initial_point_size));
        let initial_selection = SelectedFont {
            name: initial_font
                .familyName()
                .map(|name| name.to_string())
                .unwrap_or(initial.name),
            size: points_to_css_px(initial_font.pointSize()),
        };

        let (sender, receiver) = tokio::sync::oneshot::channel();
        let target = FontPickerTarget::new(mtm, initial_selection, sender);
        let panel = NSFontPanel::sharedFontPanel(mtm);
        let manager = NSFontManager::sharedFontManager(mtm);
        let previous_target = manager.target();
        let previous_action = manager.action();
        let accessory = target.make_accessory(mtm);

        panel.setAccessoryView(Some(&accessory));
        panel.setPanelFont_isMultiple(&initial_font, false);
        panel.setWorksWhenModal(true);
        panel.setEnabled(true);
        // SAFETY: target remains retained until after the modal panel closes.
        unsafe {
            manager.setTarget(Some(&*target));
            manager.setAction(sel!(changeFont:));
        }
        panel.setDelegate(Some(objc2::runtime::ProtocolObject::from_ref(&*target)));

        let parent_ptr = window.ns_window().map_err(|error| error.to_string())?;
        if parent_ptr.is_null() {
            return Err("Could not access the macOS app window".to_string());
        }
        let parent = unsafe { &*parent_ptr.cast::<NSWindow>() };
        let panel_window: &NSWindow = &panel;
        // SAFETY: both windows belong to the current AppKit process/main thread.
        unsafe { parent.addChildWindow_ordered(panel_window, NSWindowOrderingMode::Above) };
        let response = NSApplication::sharedApplication(mtm).runModalForWindow(panel_window);
        parent.removeChildWindow(panel_window);
        panel.orderOut(None);
        panel.setAccessoryView(None);
        panel.setDelegate(None);
        // SAFETY: the original target/action pair was read from the font manager.
        unsafe {
            manager.setTarget(previous_target.as_deref());
            manager.setAction(previous_action);
        }

        if response == NSModalResponseOK {
            receiver
                .blocking_recv()
                .map_err(|error| error.to_string())?
        } else {
            Ok(None)
        }
    }
}
