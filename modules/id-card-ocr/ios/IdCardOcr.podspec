Pod::Spec.new do |s|
  s.name           = 'IdCardOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device Thai text recognition (Apple Vision) for ID cards'
  s.author         = 'ThaiWell'
  s.homepage       = 'https://github.com/thaiwellai-svg/Thaiwell'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
