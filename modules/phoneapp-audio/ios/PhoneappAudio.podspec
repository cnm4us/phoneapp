Pod::Spec.new do |s|
  s.name = 'PhoneappAudio'
  s.version = '0.1.0'
  s.summary = 'Foreground Phoneapp call audio output routing'
  s.description = s.summary
  s.author = 'BA Web Tech'
  s.homepage = 'https://github.com/cnm4us/phoneapp'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/cnm4us/phoneapp.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.0'
  s.source_files = '**/*.{h,m,mm,swift}'
end
