import ExpoModulesCore
import Vision
import UIKit

/// อ่านข้อความในรูป (บัตรประชาชน) ด้วย Apple Vision บนเครื่อง — รูปไม่ถูกส่งออกไปไหน
public class IdCardOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("IdCardOcr")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cg = image.cgImage else {
        promise.reject("E_IMAGE", "อ่านรูปไม่ได้")
        return
      }
      let request = VNRecognizeTextRequest { req, error in
        if let error = error {
          promise.reject("E_OCR", error.localizedDescription)
          return
        }
        let lines = (req.results as? [VNRecognizedTextObservation] ?? [])
          .compactMap { $0.topCandidates(1).first?.string }
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["th-TH", "en-US"]
      let orientation = CGImagePropertyOrientation(image.imageOrientation)
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cg, orientation: orientation).perform([request])
        } catch {
          promise.reject("E_OCR", error.localizedDescription)
        }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
